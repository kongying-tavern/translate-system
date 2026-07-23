import client from './client'
import type { ApiResponse } from '@/types/api'
import type { ExportTemplate } from '@/types/models'

export function getExportTemplates(projectId: string) {
  return client.get<ApiResponse<ExportTemplate[]>>(`/projects/${projectId}/exports/templates`)
}
export function createExportTemplate(projectId: string, data: any) {
  return client.post<ApiResponse<ExportTemplate>>(`/projects/${projectId}/exports/templates`, data)
}
export function getExportTemplate(projectId: string, id: string) {
  return client.get<ApiResponse<ExportTemplate>>(`/projects/${projectId}/exports/templates/${id}`)
}
export function updateExportTemplate(projectId: string, id: string, data: any) {
  return client.put<ApiResponse<ExportTemplate>>(`/projects/${projectId}/exports/templates/${id}`, data)
}
export function deleteExportTemplate(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${projectId}/exports/templates/${id}`)
}
export function previewExport(projectId: string, templateId: string, languageCodes: string[], filterTags?: string[]) {
  return client.post<ApiResponse<{ content: string; format: string }>>(`/projects/${projectId}/exports/preview`, { templateId, languageCodes, filterTags })
}
export function generateExport(projectId: string, templateId: string, languageCodes: string[], filterTags?: string[]) {
  return client.post<ApiResponse<{ content: string; format: string }>>(`/projects/${projectId}/exports/generate`, { templateId, languageCodes, filterTags })
}
