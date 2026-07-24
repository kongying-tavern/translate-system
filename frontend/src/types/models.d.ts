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
  config: any
  isDefault: boolean
}

export interface LayoutConfig {
  id: string
  projectId: string
  name: string
  templateId: string | null
  overrideConfig: any
}

export interface ExportTemplate {
  id: string
  projectId: string
  name: string
  code: string
  description: string
  formatType: string
  config: any
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
