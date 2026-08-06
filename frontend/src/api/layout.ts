import type { ApiResponse } from '@/types/api'
import type { LayoutConfig, LayoutTemplate } from '@/types/models'
import { encSlug } from '@/utils/slug'
import client from './client'

// Templates
export function getTemplates(projectId: string) {
  return client.get<ApiResponse<LayoutTemplate[]>>(`/projects/${encSlug(projectId)}/layouts/templates`)
}
export function createTemplate(projectId: string, data: Omit<LayoutTemplate, 'id' | 'projectId'>) {
  return client.post<ApiResponse<LayoutTemplate>>(`/projects/${encSlug(projectId)}/layouts/templates`, data)
}
export function getTemplate(projectId: string, id: string) {
  return client.get<ApiResponse<LayoutTemplate>>(`/projects/${encSlug(projectId)}/layouts/templates/${id}`)
}
export function updateTemplate(projectId: string, id: string, data: Partial<Omit<LayoutTemplate, 'id' | 'projectId'>>) {
  return client.put<ApiResponse<LayoutTemplate>>(`/projects/${encSlug(projectId)}/layouts/templates/${id}`, data)
}
export function deleteTemplate(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${encSlug(projectId)}/layouts/templates/${id}`)
}

// Configs
export function getConfigs(projectId: string) {
  return client.get<ApiResponse<LayoutConfig[]>>(`/projects/${encSlug(projectId)}/layouts/configs`)
}
export function createConfig(projectId: string, data: Omit<LayoutConfig, 'id' | 'projectId'>) {
  return client.post<ApiResponse<LayoutConfig>>(`/projects/${encSlug(projectId)}/layouts/configs`, data)
}
export function getConfig(projectId: string, id: string) {
  return client.get<ApiResponse<LayoutConfig>>(`/projects/${encSlug(projectId)}/layouts/configs/${id}`)
}
export function updateConfig(projectId: string, id: string, data: Partial<Omit<LayoutConfig, 'id' | 'projectId'>>) {
  return client.put<ApiResponse<LayoutConfig>>(`/projects/${encSlug(projectId)}/layouts/configs/${id}`, data)
}
export function deleteConfig(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${encSlug(projectId)}/layouts/configs/${id}`)
}
export function getResolvedConfig(projectId: string, id: string) {
  return client.get<ApiResponse<unknown>>(`/projects/${encSlug(projectId)}/layouts/configs/${id}/resolved`)
}
