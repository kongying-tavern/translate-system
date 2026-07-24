import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '@/api/auth'
import { setTokens, clearTokens, getRefreshToken, getAccessToken } from '@/utils/token'
import type { User } from '@/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(!!getAccessToken())
  const role = ref('member')

  async function init() {
    if (!getAccessToken()) return
    try {
      const { data: res } = await authApi.getMe()
      user.value = res.data
      role.value = res.data.role || 'member'
    } catch { /* token might be expired, refresh will handle it */ }
  }

  async function login(account: string, password: string) {
    const { data: res } = await authApi.login(account, password)
    setTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)
    isAuthenticated.value = true
    await init()
  }

  async function register(username: string, email: string, password: string) {
    const { data: res } = await authApi.register(username, email, password)
    setTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)
    isAuthenticated.value = true
    await init()
  }

  function logout() {
    clearTokens()
    user.value = null
    isAuthenticated.value = false
    role.value = 'member'
  }

  const activeProjectId = ref(localStorage.getItem('activeProjectId') || '')
  const activeProjectName = ref(localStorage.getItem('activeProjectName') || '')

  function setActiveProject(id: string, name: string) {
    activeProjectId.value = id; activeProjectName.value = name
    localStorage.setItem('activeProjectId', id); localStorage.setItem('activeProjectName', name)
  }

  return { user, isAuthenticated, role, activeProjectId, activeProjectName, setActiveProject, init, login, register, logout }
})
