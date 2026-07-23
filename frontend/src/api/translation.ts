import client from './client'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

export interface GroupedRow {
  translationKey: string
  sourceText: string
  translations: Record<string, { id: string; translatedText: string; context?: string; tags?: string[]; isReviewed?: boolean }>
}

export function getTranslations(projectId: string, params: Record<string, any>) {
  return client.get<ApiResponse<PaginatedResponse<GroupedRow>>>(`/projects/${projectId}/translations`, { params })
}
export function createTranslation(projectId: string, data: any) {
  return client.post<ApiResponse<any>>(`/projects/${projectId}/translations`, data)
}
export function saveTranslation(projectId: string, key: string, langCode: string, data: { translatedText?: string; tags?: string[] }) {
  return client.put(`/projects/${projectId}/translations/${encodeURIComponent(key)}/${langCode}`, data)
}
export function deleteTranslation(projectId: string, id: string) {
  return client.delete(`/projects/${projectId}/translations/${id}`)
}
export function updateKey(projectId: string, oldKey: string, translationKey: string, sourceText: string) {
  return client.put(`/projects/${projectId}/translations/key/${encodeURIComponent(oldKey)}`, { translationKey, sourceText })
}
export function getTags(projectId: string) {
  return client.get<ApiResponse<string[]>>(`/projects/${projectId}/translations/tags/list`)
}
