import type { ApiResponse } from '@/types/api'
import type { BaseLanguage, ProjectLanguage } from '@/types/models'
import { encPathParam } from '@/utils/path'
import client from './client'

export function getBaseLanguages() {
  return client.get<ApiResponse<BaseLanguage[]>>('/languages')
}

export function searchBaseLanguages(q: string) {
  return client.get<ApiResponse<BaseLanguage[]>>('/languages/search', { params: { q } })
}

export function getProjectLanguages(projectId: string) {
  return client.get<ApiResponse<ProjectLanguage[]>>(`/projects/${encPathParam(projectId)}/languages`)
}

export function addProjectLanguage(projectId: string, languageCode: string) {
  return client.post<ApiResponse<ProjectLanguage>>(`/projects/${encPathParam(projectId)}/languages`, { languageCode })
}

export function removeProjectLanguage(projectId: string, languageCode: string) {
  return client.delete<ApiResponse<null>>(`/projects/${encPathParam(projectId)}/languages/${encPathParam(languageCode)}`)
}
