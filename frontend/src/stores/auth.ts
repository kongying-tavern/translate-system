import type { User } from '@/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '@/api/auth'
import { SystemRole } from '@/utils/roles'
import { clearTokens, getAccessToken, setTokens } from '@/utils/token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(!!getAccessToken())
  const role = ref<string>(SystemRole.User)

  async function init() {
    if (!getAccessToken())
      return
    try {
      const { data: res } = await authApi.getMe()
      user.value = res.data
      role.value = res.data.role || SystemRole.User
    }
    catch { /* token might be expired, refresh will handle it */ }
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
    role.value = SystemRole.User
  }

  const activeProjectSlug = ref(localStorage.getItem('activeProjectSlug') || '')
  const activeProjectName = ref(localStorage.getItem('activeProjectName') || '')

  function setActiveProject(id: string, name: string, code?: string) {
    const slug = code || id
    activeProjectSlug.value = slug
    activeProjectName.value = name
    localStorage.setItem('activeProjectSlug', slug)
    localStorage.setItem('activeProjectName', name)
  }

  return { user, isAuthenticated, role, activeProjectSlug, activeProjectName, setActiveProject, init, login, register, logout }
})
