import client from './client'
import type { ApiResponse, PageData } from '@/types/api'
import type { Project } from '@/types/models'

export function getProjects(page = 1, pageSize = 20) {
  return client.get<ApiResponse<PageData<Project>>>('/projects', { params: { page, pageSize } })
}

export function getProject(id: string) {
  return client.get<ApiResponse<Project>>(`/projects/${id}`)
}

export function createProject(data: { name: string; description?: string; sourceLanguage?: string }) {
  return client.post<ApiResponse<Project>>('/projects', data)
}

export function updateProject(id: string, data: { name: string; description?: string; sourceLanguage?: string }) {
  return client.put<ApiResponse<Project>>(`/projects/${id}`, data)
}

export function deleteProject(id: string) {
  return client.delete<ApiResponse<null>>(`/projects/${id}`)
}
export function getMembers(projectId: string) {
  return client.get<ApiResponse<any[]>>(`/projects/${projectId}/members`)
}
export function addMember(projectId: string, email: string) {
  return client.post<ApiResponse<any>>(`/projects/${projectId}/members`, { email })
}
export function removeMember(projectId: string, memberId: string) {
  return client.delete(`/projects/${projectId}/members/${memberId}`)
}
