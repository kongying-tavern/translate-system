import type { ExportFormat } from '@/data/exportFormats'

export interface User {
  id: string
  username: string
  email: string
  avatarUrl?: string
  role: string
  createdAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  code: string
  description: string
  sourceLanguage: string
  projectRole: string | null
  createdAt: string
  updatedAt: string
}

export interface BaseLanguage {
  languageCode: string
  englishName: string
  nativeName: string
}

export interface ProjectLanguage {
  id: string
  projectId: string
  languageCode: string
  alias: string
  sortOrder: number
}

export interface Translation {
  id: string
  projectId: string
  languageCode: string
  translationKey: string
  sourceText: string
  translatedText: string
  context: string
  tags: string[]
  isReviewed: boolean
  reviewerComment: string
  createdAt: string
  updatedAt: string
}

export interface LayoutTemplate {
  id: string
  projectId: string
  name: string
  description: string
  thumbnailUrl: string
  config: unknown
  isDefault: boolean
}

export interface LayoutConfig {
  id: string
  projectId: string
  name: string
  templateId: string | null
  overrideConfig: unknown
}

export interface ExportTemplate {
  id: string
  projectId: string
  name: string
  code: string
  description: string
  formatType: ExportFormat
  config: unknown
}

export interface ProjectMember {
  id: string
  userId: string
  username: string
  email: string
  role: string
  projectRole: string
  createdAt: string
}

export interface ApiKey {
  id: string
  name: string
  apiKey: string
  secret: string
  enabled: boolean
  lastUsed: string | null
  createdAt: string
}

export interface TranslationKey {
  id: string
  projectId: string
  key: string
  sourceText: string
  context: string | null
  tags: string[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TranslationValue {
  id: string
  keyId: string
  languageCode: string
  translatedText: string
  isReviewed: boolean
  reviewerComment: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** 导入进度阶段 */
export type ImportPhase = 'parsing' | 'writing' | 'done'

/** 导入进度（与后端 ImportProgress 对应） */
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

/** 导入结果（与后端 ImportResult 对应） */
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
}

/** 导入状态（与后端 ImportStatusRow 对应） */
export interface ImportStatusRow {
  /** 是否正有导入在跑 */
  locked: boolean
  /** 导入类型（entries 条目 / translations 译文；无导入时为空） */
  type: string
  /** 发起导入的用户 id（无导入时为空） */
  startUserId: string
  /** 发起导入的用户名（无导入时为空） */
  startUsername: string
  /** 发起导入的时间（无导入时为空） */
  startTimestamp: number
  /** 导入进度（有导入时为对象，否则为 null） */
  progress: ImportProgress | null
  /** 导入结束后的结果（无导入时为 null） */
  result: ImportResult | null
  /** 导入失败的错误信息（无导入或成功时为 null） */
  error: string | null
}
