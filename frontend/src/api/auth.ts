import type { ApiResponse } from '@/types/api'
import type { AuthResponse, User } from '@/types/models'
import { encPathParam } from '@/utils/path'
import client from './client'

export function register(username: string, email: string, password: string) {
  return client.post<ApiResponse<AuthResponse>>('/auth/register', { username, email, password })
}
export function login(account: string, password: string) {
  return client.post<ApiResponse<AuthResponse>>('/auth/login', { account, password })
}
export function refresh(refreshToken: string) {
  return client.post<ApiResponse<AuthResponse>>('/auth/refresh', { refreshToken })
}
export function getMe() {
  return client.get<ApiResponse<User>>('/auth/me')
}
export function getUsers() {
  return client.get<ApiResponse<User[]>>('/auth/users')
}
export function updateUserRole(id: string, role: string) {
  return client.put<ApiResponse<User>>(`/auth/users/${encPathParam(id)}/role`, { role })
}
export function createUser(data: { username: string, email: string, password: string, role: string }) {
  return client.post<ApiResponse<User>>('/auth/users', data)
}
export function deleteUser(id: string) {
  return client.delete<ApiResponse<null>>(`/auth/users/${encPathParam(id)}`)
}
export function changePassword(id: string, password: string) {
  return client.put<ApiResponse<null>>(`/auth/users/${encPathParam(id)}/password`, { password })
}
