export interface User {
  id: string; username: string; email: string; avatarUrl?: string; role: string
}

export interface Project {
  id: string
  userId: string
  name: string
  code: string
  description: string
  sourceLanguage: string
  createdAt: string
  updatedAt: string
}

export interface BaseLanguage {
  languageCode: string
  englishName: string
  nativeName: string
  iso639_1: string
  iso639_2: string
  iso639_3: string
  region: string
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
  formatType: string
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

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
