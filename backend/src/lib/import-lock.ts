import { EventEmitter } from 'node:events'

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

export interface ImportResult {
  /** 解析出的去重翻译键数量（条目维度） */
  importedKeys: number
  /** 解析出的条目总数（含多语言格式展开） */
  importedFields: number
  /** 新建的字段（翻译值）数量 */
  createdFields: number
  /** 新建的去重翻译键数量 */
  createdKeys: number
  /** 跳过的字段（翻译值）数量（含因项目未配置语言而跳过的） */
  skippedFields: number
  /** 跳过的去重翻译键数量 */
  skippedKeys: number
  /** 因项目未配置语言而被跳过的语言代码（去重） */
  skippedLanguages: string[]
  /** 源语言列被跳过的字段数（源语言译文即原文列，翻译导入恒不触碰）；为 0 时前端不展示该行 */
  sourceSkippedFields?: number
}

export interface ImportControl {
  aborted: boolean
  /** 所属项目 id */
  projectId: string
  /** 发起导入的用户 id */
  userId: string
  /** 发起导入的时间 */
  startedAt: number
  /** 导入类型（entries 条目 / translations 译文） */
  type: ImportLockType
  /** 导入进度（解析/写入阶段实时更新，status 接口可读） */
  progress: ImportProgress
  /** 导入是否已结束（成功/失败/中止），结束后锁不再阻塞新导入，结果可读 */
  done: boolean
  /** 导入完成后的结果（done 后为非 null） */
  result?: ImportResult
  /** 导入失败时的错误信息（done 且 result 为 undefined 时存在） */
  error?: string
}

const locks = new Map<string, ImportControl>()

/**
 * 尝试获取项目导入锁；同一项目正在导入（未结束）时返回 null，跨项目互不影响。
 * 若上一次导入已结束（done），则覆盖之，避免残留控制对象长期占用。
 */
export function tryAcquireImportLock(projectId: string, userId: string, type: ImportLockType): ImportControl | null {
  const existing = locks.get(projectId)
  if (existing && !existing.done)
    return null
  const ctrl: ImportControl = {
    aborted: false,
    projectId,
    userId,
    startedAt: Date.now(),
    type,
    progress: { phase: 'parsing', parsedFields: 0, parsedKeys: 0, totalFields: 0, totalKeys: 0, createdFields: 0, createdKeys: 0, skippedFields: 0, skippedKeys: 0 },
    done: false,
  }
  locks.set(projectId, ctrl)
  return ctrl
}

export function releaseImportLock(projectId: string): void {
  locks.delete(projectId)
}

/** 查询项目当前导入控制对象（含已结束但未清理的），无则返回 undefined */
export function getImportLock(projectId: string): ImportControl | undefined {
  return locks.get(projectId)
}

/** 请求中止该项目正在进行的导入；无进行中导入（或已结束）时返回 false */
export function abortImport(projectId: string): boolean {
  const ctrl = locks.get(projectId)
  if (!ctrl || ctrl.done)
    return false
  ctrl.aborted = true
  return true
}

/**
 * 导入状态变更事件：控制对象在解析/写入/结束/中止时通过 emitImportStatus 广播，
 * SSE 接口据此向订阅该项目的客户端推送最新状态，替代前端轮询。
 */
const importEmitter = new EventEmitter()
importEmitter.setMaxListeners(0)

/** 广播某项目的导入状态已变更（由后端在进度更新/结束时调用） */
export function emitImportStatus(projectId: string): void {
  importEmitter.emit(`imp:${projectId}`)
}

/** 订阅某项目的导入状态变更，返回取消订阅函数 */
export function subscribeImportStatus(projectId: string, cb: () => void): () => void {
  const ev = `imp:${projectId}`
  importEmitter.on(ev, cb)
  return () => importEmitter.off(ev, cb)
}
