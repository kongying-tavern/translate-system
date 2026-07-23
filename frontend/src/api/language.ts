import client from './client'
import type { ApiResponse } from '@/types/api'
import type { BaseLanguage, ProjectLanguage } from '@/types/models'

export function getBaseLanguages() {
  return client.get<ApiResponse<BaseLanguage[]>>('/languages')
}

export function searchBaseLanguages(q: string) {
  return client.get<ApiResponse<BaseLanguage[]>>('/languages/search', { params: { q } })
}

export function getProjectLanguages(projectId: string) {
  return client.get<ApiResponse<ProjectLanguage[]>>(`/projects/${projectId}/languages`)
}

export function addProjectLanguage(projectId: string, languageCode: string) {
  return client.post<ApiResponse<ProjectLanguage>>(`/projects/${projectId}/languages`, { languageCode })
}

export function removeProjectLanguage(projectId: string, languageCode: string) {
  return client.delete<ApiResponse<null>>(`/projects/${projectId}/languages/${languageCode}`)
}
