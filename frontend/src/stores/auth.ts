import type { User } from '@/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/api/auth'
import { useProjectStore } from '@/stores/project'
import { SystemRole } from '@/utils/roles'
import { clearTokens, getAccessToken, setTokens } from '@/utils/token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(!!getAccessToken())
  const role = ref<string>(SystemRole.User)

  const projectStore = useProjectStore()

  const activeProjectSlug = ref(localStorage.getItem('activeProjectSlug') || '')
  const activeProjectName = computed(() => projectStore.getProject(activeProjectSlug.value)?.name ?? '')
  const projectRole = computed(() => projectStore.getProject(activeProjectSlug.value)?.projectRole ?? null)

  function setActiveProject(slug: string) {
    activeProjectSlug.value = slug
    if (slug)
      localStorage.setItem('activeProjectSlug', slug)
    else
      localStorage.removeItem('activeProjectSlug')
  }

  async function init() {
    if (!getAccessToken())
      return
    try {
      const { data: res } = await authApi.getMe()
      user.value = res.data
      role.value = res.data.role || SystemRole.User
    }
    catch { /* token might be expired, refresh will handle it */ }
    try {
      await projectStore.fetchProjects()
    }
    catch { /* 项目列表加载失败不阻断启动 */ }
    if (projectStore.loaded && activeProjectSlug.value && !projectStore.getProject(activeProjectSlug.value))
      setActiveProject('')
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
    setActiveProject('')
    projectStore.clear()
  }

  return { user, isAuthenticated, role, projectRole, activeProjectSlug, activeProjectName, setActiveProject, init, login, register, logout }
})
