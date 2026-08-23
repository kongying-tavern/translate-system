import type { MaybeRefOrGetter } from 'vue'
import type { ImportProgress, ImportStatusRow } from '@/types/models'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import client from '@/api/client'
import { formatCount } from '@/utils/format'
import { encPathParam } from '@/utils/path'
import { getAccessToken } from '@/utils/token'

/**
 * 共享导入锁状态：优先通过 SSE（`GET /projects/{slug}/imports/status/stream`）实时订阅状态变更，
 * 连接失败/断开时自动回退到轮询 `GET /projects/{slug}/imports/status`。
 * - 任意项目成员可访问（仅 @Security('auth') + assertProjectAccess），锁状态跨角色/跨标签页实时生效。
 * - slug 变更自动重置；组件卸载自动停止。
 */
export function useImportStatus(projectSlug: MaybeRefOrGetter<string>, options?: { importing?: MaybeRefOrGetter<boolean> }) {
  // ---- 状态 ----
  const isLocked = ref(false)
  const importType = ref('')
  const importerName = ref('')
  const importerId = ref('')
  const progress = ref<ImportProgress | null>(null)
  const status = ref<ImportStatusRow | null>(null)

  function applyRow(row: ImportStatusRow | null) {
    isLocked.value = !!row?.locked
    importType.value = row?.type || ''
    importerName.value = row?.startUsername || ''
    importerId.value = row?.startUserId || ''
    progress.value = row?.progress ?? null
    status.value = row
  }
  function resetRow() {
    applyRow(null)
  }

  // ---- 数据加载：轮询回退 + SSE 优先 ----
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

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let sseAbort: AbortController | undefined

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
  function startPolling() {
    stopPolling()
    void load()
    pollTimer = setInterval(() => void load(), isLocked.value ? 2000 : 30000)
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
      // 服务端正常关闭（后端重启/代理断开等）：与异常同等对待，立即拉取一次状态并回退轮询，避免页面永久失聪
      if (!ctrl.signal.aborted)
        startPolling()
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

  // ---- 生命周期 ----
  // 轮询回退模式下，锁状态切换时调整频率（进行中 2s，空闲 30s）
  watch(isLocked, () => {
    if (pollTimer)
      startPolling()
  })
  watch(() => toValue(projectSlug), () => {
    resetRow()
    start()
  }, { immediate: true })
  onBeforeUnmount(stop)

  // ---- 派生状态 ----
  /** 当前用户是否为该导入的发起人（跨标签页也能中止） */
  const iAmImporter = computed(() => isLocked.value && !!importerId.value && importerId.value === (status.value?.startUserId || ''))
  const isTranslate = computed(() => importType.value === 'translations')

  /** 阶段文案：解析中 / 写入中 / 写入完成 */
  const phaseText = computed(() => {
    const ph = progress.value?.phase
    if (ph === 'parsing')
      return '解析中'
    if (ph === 'writing')
      return '写入中'
    if (ph === 'done')
      return '写入完成'
    return ''
  })
  /** 写入阶段进度百分比（解析/无总数时为 0） */
  const progressPct = computed(() => {
    const p = progress.value
    if (!p)
      return 0
    const total = isTranslate.value ? p.totalFields : p.totalKeys
    const done = isTranslate.value ? p.createdFields + p.skippedFields : p.createdKeys + p.skippedKeys
    if (!total)
      return 0
    return Math.min(100, Math.max(0, Math.floor((done / total) * 100)))
  })
  /** 状态行：写入中（4%）/ 解析中 / 写入完成 */
  const statusLine = computed(() => {
    if (!phaseText.value)
      return ''
    if (progress.value?.phase === 'writing')
      return `${phaseText.value}（${progressPct.value}%）`
    return phaseText.value
  })
  /** 明细多行文案：解析阶段显示已解析量；写入/完成阶段分行显示「字段」「条目」总/新增/跳过 */
  const statsLines = computed<string[]>(() => {
    const p = progress.value
    if (!p)
      return []
    if (p.phase === 'parsing')
      return [`解析：${formatCount(p.parsedKeys)} 条 / ${formatCount(p.parsedFields)} 个字段`]
    const lines: string[] = []
    // 导入条目（entries）仅用「条目（键）」维度；导入译文（translations）同时展示字段/条目
    if (isTranslate.value)
      lines.push(`字段：总 ${formatCount(p.totalFields)} 个，新增 ${formatCount(p.createdFields)} 个，跳过 ${formatCount(p.skippedFields)} 个`)
    lines.push(`条目：总 ${formatCount(p.totalKeys)} 条，新增 ${formatCount(p.createdKeys)} 条，跳过 ${formatCount(p.skippedKeys)} 条`)
    return lines
  })
  /** 翻译管理页/语言管理页等被锁定页共用的 banner 标题（含发起人 + 阶段百分比） */
  const bannerTitle = computed(() => {
    const type = importType.value === 'translations' ? '翻译' : '条目'
    const who = importerName.value ? `（发起人：${importerName.value}）` : ''
    const pct = statusLine.value ? ` · ${statusLine.value}` : ''
    return `正在导入${type}${who}${pct}，本页已锁定，暂不可编辑，导入结束后自动恢复`
  })
  /** 导入提示标题：自己发起（含本地提交中）或他人占用均统一产出文案；能否「中止」由调用方按是否本人决定 */
  const importTitle = computed(() => {
    const typeLabel = importType.value === 'translations' ? '翻译' : '条目'
    const state = statusLine.value
    const isSelf = (options?.importing ? toValue(options.importing) : false) || iAmImporter.value
    if (isSelf) {
      if (!progress.value)
        return '正在提交导入任务，请稍候…'
      return `正在导入${typeLabel}：${state}`
    }
    if (isLocked.value) {
      const who = importerName.value || '他人'
      if (!progress.value)
        return `正在由${who}导入${typeLabel}，请稍候`
      return `正在由${who}导入${typeLabel}：${state}`
    }
    return ''
  })

  return { isLocked, importType, importerName, importerId, progress, status, load, start, stop, reset: resetRow, iAmImporter, phaseText, progressPct, statusLine, statsLines, bannerTitle, importTitle }
}
