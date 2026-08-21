import type { MaybeRefOrGetter } from 'vue'
import type { ImportProgress, ImportStatusRow } from '@/types/models'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import client from '@/api/client'
import { encPathParam } from '@/utils/path'
import { getAccessToken } from '@/utils/token'

/**
 * 共享导入锁状态：优先通过 SSE（`GET /projects/{slug}/imports/status/stream`）实时订阅状态变更，
 * 连接失败/断开时自动回退到轮询 `GET /projects/{slug}/imports/status`。
 * - 任意项目成员可访问（仅 @Security('auth') + assertProjectAccess），锁状态跨角色/跨标签页实时生效。
 * - slug 变更自动重置；组件卸载自动停止。
 */
export function useImportStatus(projectSlug: MaybeRefOrGetter<string>) {
  const locked = ref(false)
  const lockType = ref('')
  const locker = ref('')
  const lockerId = ref('')
  const progress = ref<ImportProgress | null>(null)
  const status = ref<ImportStatusRow | null>(null)

  function applyRow(row: ImportStatusRow | null) {
    locked.value = !!row?.locked
    lockType.value = row?.type || ''
    locker.value = row?.startUsername || ''
    lockerId.value = row?.startUserId || ''
    progress.value = row?.progress ?? null
    status.value = row
  }

  async function load() {
    const slug = toValue(projectSlug)
    if (!slug)
      return
    try {
      const { data: res } = await client.get(`/projects/${encPathParam(slug)}/imports/status`)
      applyRow((res.data ?? null) as ImportStatusRow | null)
    }
    catch {
      applyRow(null)
    }
  }

  // ---- SSE 订阅（优先）----
  let sseAbort: AbortController | undefined
  // ---- 轮询回退 ----
  let pollTimer: ReturnType<typeof setInterval> | undefined

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
  function startPolling() {
    stopPolling()
    void load()
    pollTimer = setInterval(() => void load(), locked.value ? 2000 : 30000)
  }
  function stopSSE() {
    sseAbort?.abort()
    sseAbort = undefined
  }

  async function startSSE() {
    stopSSE()
    const slug = toValue(projectSlug)
    if (!slug)
      return
    const token = getAccessToken()
    if (!token)
      return
    const ctrl = new AbortController()
    sseAbort = ctrl
    const url = `/api/v1/projects/${encPathParam(slug)}/imports/status/stream`
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      if (!resp.ok || !resp.body)
        throw new Error('import sse unavailable')
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done)
          break
        buf += decoder.decode(value, { stream: true })
        let idx = buf.indexOf('\n\n')
        while (idx >= 0) {
          const frame = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const dataLine = frame.split('\n').find(l => l.startsWith('data:'))
          if (dataLine) {
            const json = dataLine.slice(5).trim()
            if (json) {
              try {
                applyRow(JSON.parse(json) as ImportStatusRow)
              }
              catch {
                // 忽略单帧解析错误
              }
            }
          }
          idx = buf.indexOf('\n\n')
        }
      }
    }
    catch {
      // 连接失败/被中止（非主动 stop）时回退轮询
      if (!ctrl.signal.aborted)
        startPolling()
    }
  }

  function start() {
    stopPolling()
    stopSSE()
    void startSSE()
  }
  function stop() {
    stopPolling()
    stopSSE()
  }

  // 轮询回退模式下，锁状态切换时调整频率（进行中 2s，空闲 30s）
  watch(locked, () => {
    if (pollTimer)
      startPolling()
  })
  watch(() => toValue(projectSlug), () => {
    applyRow(null)
    start()
  }, { immediate: true })

  onBeforeUnmount(stop)

  /** 当前用户是否为该导入的发起人（跨标签页也能中止） */
  const iAmImporter = computed(() => locked.value && !!lockerId.value && lockerId.value === (status.value?.startUserId || ''))
  const lockTypeName = computed(() => lockType.value === 'translations' ? '翻译' : '条目')
  /** 导入进度文案：解析阶段显示已解析量；写入阶段按维度显示「已处理 / 总数（百分比）」——条目模式用键维度、翻译模式用字段维度 */
  const progressText = computed(() => {
    const p = progress.value
    if (!p)
      return ''
    const isTranslate = lockType.value === 'translations'
    if (p.phase === 'parsing')
      return `解析中 ${p.parsedKeys.toLocaleString()} 条目 / ${p.parsedFields.toLocaleString()} 字段`
    if (p.phase === 'writing') {
      const done = isTranslate ? p.createdFields + p.skippedFields : p.createdKeys + p.skippedKeys
      const total = isTranslate ? p.totalFields : p.totalKeys
      const dim = isTranslate ? '字段' : '条目'
      // 分母为 0（理论上不会发生，解析空数据已在 parseImportData 抛错）时跳过进度，避免 NaN%/Infinity%
      if (!total)
        return ''
      const pct = Math.min(100, Math.max(0, Math.floor((done / total) * 100)))
      return `进度 ${done.toLocaleString()} / ${total.toLocaleString()} ${dim}（${pct}%）`
    }
    if (p.phase === 'done')
      return '写入完成'
    return ''
  })

  return { locked, lockType, locker, lockerId, progress, status, load, start, stop, iAmImporter, lockTypeName, progressText }
}
