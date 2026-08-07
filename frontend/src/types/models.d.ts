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
