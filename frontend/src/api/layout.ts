import client from './client'
import type { ApiResponse } from '@/types/api'
import type { LayoutTemplate, LayoutConfig } from '@/types/models'

// Templates
export function getTemplates(projectId: string) {
  return client.get<ApiResponse<LayoutTemplate[]>>(`/projects/${projectId}/layouts/templates`)
}
export function createTemplate(projectId: string, data: any) {
  return client.post<ApiResponse<LayoutTemplate>>(`/projects/${projectId}/layouts/templates`, data)
}
export function getTemplate(projectId: string, id: string) {
  return client.get<ApiResponse<LayoutTemplate>>(`/projects/${projectId}/layouts/templates/${id}`)
}
export function updateTemplate(projectId: string, id: string, data: any) {
  return client.put<ApiResponse<LayoutTemplate>>(`/projects/${projectId}/layouts/templates/${id}`, data)
}
export function deleteTemplate(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${projectId}/layouts/templates/${id}`)
}

// Configs
export function getConfigs(projectId: string) {
  return client.get<ApiResponse<LayoutConfig[]>>(`/projects/${projectId}/layouts/configs`)
}
export function createConfig(projectId: string, data: any) {
  return client.post<ApiResponse<LayoutConfig>>(`/projects/${projectId}/layouts/configs`, data)
}
export function getConfig(projectId: string, id: string) {
  return client.get<ApiResponse<LayoutConfig>>(`/projects/${projectId}/layouts/configs/${id}`)
}
export function updateConfig(projectId: string, id: string, data: any) {
  return client.put<ApiResponse<LayoutConfig>>(`/projects/${projectId}/layouts/configs/${id}`, data)
}
export function deleteConfig(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${projectId}/layouts/configs/${id}`)
}
export function getResolvedConfig(projectId: string, id: string) {
  return client.get<ApiResponse<any>>(`/projects/${projectId}/layouts/configs/${id}/resolved`)
}
