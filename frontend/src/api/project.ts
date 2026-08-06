import type { ApiResponse, PageData } from '@/types/api'
import type { Project, ProjectMember } from '@/types/models'
import { encSlug } from '@/utils/slug'
import client from './client'

export function getProjects(page = 1, pageSize = 20) {
  return client.get<ApiResponse<PageData<Project>>>('/projects', { params: { page, pageSize } })
}

export function getProject(id: string) {
  return client.get<ApiResponse<Project>>(`/projects/${encSlug(id)}`)
}

export function createProject(data: { name: string, code: string, description?: string, sourceLanguage?: string }) {
  return client.post<ApiResponse<Project>>('/projects', data)
}

export function updateProject(id: string, data: { name: string, code?: string, description?: string, sourceLanguage?: string }) {
  return client.put<ApiResponse<Project>>(`/projects/${encSlug(id)}`, data)
}

export function deleteProject(id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${encSlug(id)}`)
}
export function getMembers(projectId: string) {
  return client.get<ApiResponse<ProjectMember[]>>(`/projects/${encSlug(projectId)}/members`)
}
export function addMember(projectId: string, email: string, projectRole = 'member') {
  return client.post<ApiResponse<ProjectMember>>(`/projects/${encSlug(projectId)}/members`, { email, projectRole })
}
export function removeMember(projectId: string, memberId: string) {
  return client.delete(`/projects/${encSlug(projectId)}/members/${memberId}`)
}
