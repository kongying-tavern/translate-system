export type ImportLockType = 'entries' | 'translations'

export type ImportPhase = 'parsing' | 'writing' | 'done'

export interface ImportProgress {
  /** 当前阶段 */
  phase: ImportPhase
  /** 已解析字段数（parse 阶段持续更新） */
  parsedFields: number
  /** 已解析的去重键数（parse 阶段持续更新） */
  parsedKeys: number
  /** 解析完成后的总字段数（write 阶段可读） */
  totalFields: number
  /** 解析完成后的去重键数（write 阶段可读） */
  totalKeys: number
  /** 已写入字段数（write 阶段持续更新） */
  createdFields: number
  /** 已写入的去重键数 */
  createdKeys: number
  /** 已跳过字段数（write 阶段持续更新） */
  skippedFields: number
  /** 已跳过的去重键数 */
  skippedKeys: number
}

export interface ImportControl {
  aborted: boolean
  /** 发起导入的用户 id */
  userId: string
  /** 发起导入的时间 */
  startedAt: number
  /** 导入类型（entries 条目 / translations 译文） */
  type: ImportLockType
  /** 导入进度（解析/写入阶段实时更新，status 接口可读） */
  progress: ImportProgress
}

const locks = new Map<string, ImportControl>()

/** 尝试获取项目导入锁；同一项目已在导入时返回 null，跨项目互不影响 */
export function tryAcquireImportLock(projectId: string, userId: string, type: ImportLockType): ImportControl | null {
  if (locks.has(projectId))
    return null
  const ctrl: ImportControl = {
    aborted: false,
    userId,
    startedAt: Date.now(),
    type,
    progress: { phase: 'parsing', parsedFields: 0, parsedKeys: 0, totalFields: 0, totalKeys: 0, createdFields: 0, createdKeys: 0, skippedFields: 0, skippedKeys: 0 },
  }
  locks.set(projectId, ctrl)
  return ctrl
}

export function releaseImportLock(projectId: string): void {
  locks.delete(projectId)
}

/** 查询项目当前是否正有导入在跑 */
export function getImportLock(projectId: string): ImportControl | undefined {
  return locks.get(projectId)
}

/** 请求中止该项目正在进行的导入；无进行中导入时返回 false */
export function abortImport(projectId: string): boolean {
  const ctrl = locks.get(projectId)
  if (!ctrl)
    return false
  ctrl.aborted = true
  return true
}
