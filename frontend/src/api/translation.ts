import type { ApiResponse, PageData } from '@/types/api'
import type { TranslationKey, TranslationValue } from '@/types/models'
import { encSlug } from '@/utils/slug'
import client from './client'

export interface GroupedRow {
  rowIndex: number
  sortOrder: number
  translationKey: string
  sourceText: string
  context: string
  tags: string[]
  keyId: string
  translations: Record<string, { id: string, translatedText: string, isReviewed?: boolean, reviewerComment?: string }>
}

export interface CreateTranslationData {
  translationKey: string
  languageCode: string
  sourceText: string
  translatedText?: string
  context?: string
  tags?: string[]
}

export interface TranslationQuery {
  page: number
  pageSize: number
  languageCode?: string
  search?: string
  tags?: string
  untransOnly?: boolean
}

export function getTranslations(projectId: string, params: TranslationQuery) {
  return client.get<ApiResponse<PageData<GroupedRow>>>(`/projects/${encSlug(projectId)}/translations`, { params })
}
export function createTranslation(projectId: string, data: CreateTranslationData) {
  return client.post<ApiResponse<TranslationKey & { value: TranslationValue }>>(`/projects/${encSlug(projectId)}/translations`, data)
}
export function saveTranslation(projectId: string, key: string, langCode: string, data: { translatedText?: string, tags?: string[], context?: string }) {
  return client.put(`/projects/${encSlug(projectId)}/translations/${encodeURIComponent(key)}/${langCode}`, data)
}
export function deleteTranslation(projectId: string, id: string) {
  return client.delete(`/projects/${encSlug(projectId)}/translations/${id}`)
}
export function updateKey(projectId: string, oldKey: string, translationKey: string, sourceText: string) {
  return client.put(`/projects/${encSlug(projectId)}/translations/key/${encodeURIComponent(oldKey)}`, { translationKey, sourceText })
}
export function getTags(projectId: string) {
  return client.get<ApiResponse<string[]>>(`/projects/${encSlug(projectId)}/translations/tags/list`)
}
