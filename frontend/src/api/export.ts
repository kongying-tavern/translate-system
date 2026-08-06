import type { ApiResponse } from '@/types/api'
import type { ExportTemplate } from '@/types/models'
import { encSlug } from '@/utils/slug'
import client from './client'

export function getExportTemplates(projectId: string) {
  return client.get<ApiResponse<ExportTemplate[]>>(`/projects/${encSlug(projectId)}/exports/templates`)
}
export function createExportTemplate(projectId: string, data: Omit<ExportTemplate, 'id' | 'projectId'>) {
  return client.post<ApiResponse<ExportTemplate>>(`/projects/${encSlug(projectId)}/exports/templates`, data)
}
export function getExportTemplate(projectId: string, id: string) {
  return client.get<ApiResponse<ExportTemplate>>(`/projects/${encSlug(projectId)}/exports/templates/${id}`)
}
export function updateExportTemplate(projectId: string, id: string, data: Partial<Omit<ExportTemplate, 'id' | 'projectId'>>) {
  return client.put<ApiResponse<ExportTemplate>>(`/projects/${encSlug(projectId)}/exports/templates/${id}`, data)
}
export function deleteExportTemplate(projectId: string, id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${encSlug(projectId)}/exports/templates/${id}`)
}
export function previewExport(projectSlug: string, templateSlug: string, languageCodes: string[], filterTags?: string[]) {
  return client.post<ApiResponse<{ content: string, format: string, encoding?: string }>>(`/projects/${encSlug(projectSlug)}/exports/preview`, { templateSlug, languageCodes, filterTags })
}
export function generateExport(projectSlug: string, templateSlug: string, languageCodes: string[], filterTags?: string[]) {
  return client.post<ApiResponse<{ content: string, format: string, encoding?: string }>>(`/projects/${encSlug(projectSlug)}/exports/generate`, { templateSlug, languageCodes, filterTags })
}
