import type { MaybeRefOrGetter } from 'vue'
import type { ImportProgress, ImportStatusRow } from '@/types/models'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import client from '@/api/client'
import { encPathParam } from '@/utils/path'

/**
 * 共享导入锁状态：轮询 `GET /projects/{slug}/imports/status`，驱动导入页与翻译管理页的并发锁定。
 * - 任意项目成员可访问（仅 @Security('auth') + assertProjectAccess），锁状态跨角色/跨标签页实时生效。
 * - 轮询频率随锁状态切换：进行中 2 秒 / 空闲 30 秒；slug 变更自动重置；组件卸载自动停止。
 */
export function useImportStatus(projectSlug: MaybeRefOrGetter<string>) {
  const locked = ref(false)
  const lockType = ref('')
  const locker = ref('')
  const lockerId = ref('')
  const progress = ref<ImportProgress | null>(null)
  const status = ref<ImportStatusRow | null>(null)

  async function load() {
    const slug = toValue(projectSlug)
    if (!slug)
      return
    try {
      const { data: res } = await client.get(`/projects/${encPathParam(slug)}/imports/status`)
      const row = (res.data ?? null) as ImportStatusRow | null
      locked.value = !!row?.locked
      lockType.value = row?.type || ''
      locker.value = row?.startUsername || ''
      lockerId.value = row?.startUserId || ''
      progress.value = row?.progress ?? null
      status.value = row
    }
    catch {
      locked.value = false
      lockType.value = ''
      locker.value = ''
      lockerId.value = ''
      progress.value = null
      status.value = null
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  function start() {
    clearInterval(timer)
    void load()
    timer = setInterval(() => void load(), locked.value ? 2000 : 30000)
  }
  function stop() {
    clearInterval(timer)
    timer = undefined
  }

  watch(locked, () => {
    if (timer)
      start()
  })
  watch(() => toValue(projectSlug), () => {
    locked.value = false
    lockType.value = ''
    locker.value = ''
    lockerId.value = ''
    progress.value = null
    status.value = null
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
      if (!total)
        return ''
      const pct = Math.floor((done / total) * 100)
      const dim = isTranslate ? '字段' : '条目'
      return `进度 ${done.toLocaleString()} / ${total.toLocaleString()} ${dim}（${pct}%）`
    }
    if (p.phase === 'done')
      return '写入完成'
    return ''
  })

  return { locked, lockType, locker, lockerId, progress, status, load, start, stop, iAmImporter, lockTypeName, progressText }
}
