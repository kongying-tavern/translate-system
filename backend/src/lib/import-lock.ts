export type ImportLockType = 'entries' | 'translations'

export interface ImportControl {
  aborted: boolean
  /** 发起导入的用户 id */
  userId: string
  /** 发起导入的时间 */
  startedAt: number
  /** 导入类型（entries 条目 / translations 译文） */
  type: ImportLockType
}

const locks = new Map<string, ImportControl>()

/** 尝试获取项目导入锁；同一项目已在导入时返回 null，跨项目互不影响 */
export function tryAcquireImportLock(projectId: string, userId: string, type: ImportLockType): ImportControl | null {
  if (locks.has(projectId))
    return null
  const ctrl: ImportControl = { aborted: false, userId, startedAt: Date.now(), type }
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
