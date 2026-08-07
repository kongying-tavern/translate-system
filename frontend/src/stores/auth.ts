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
    startPermissionPolling()
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let visibilityHandler: (() => void) | null = null
  let refreshing = false

  /** 刷新权限来源：系统角色（getMe）+ 项目角色（项目列表），UI 权限 computeds 依赖这两处 store 状态，更新后响应式隐藏/显示操作入口 */
  async function refreshPermissions() {
    if (!getAccessToken() || refreshing)
      return
    refreshing = true
    try {
      try {
        const { data: res } = await authApi.getMe()
        user.value = res.data
        role.value = res.data.role || SystemRole.User
      }
      catch { /* 网络或 token 失效，401 由 client 拦截器统一处理 */ }
      try {
        await projectStore.fetchProjects(true)
      }
      catch { /* 项目列表刷新失败不阻断 */ }
      if (projectStore.loaded && activeProjectSlug.value && !projectStore.getProject(activeProjectSlug.value))
        setActiveProject('')
    }
    finally {
      refreshing = false
    }
  }

  /** 每 30 秒轮询一次权限；标签页在后台时跳过，回到前台立即补一次 */
  function startPermissionPolling() {
    if (pollTimer || !getAccessToken())
      return
    pollTimer = setInterval(() => {
      if (!document.hidden)
        refreshPermissions()
    }, 30000)
    visibilityHandler = () => {
      if (!document.hidden)
        refreshPermissions()
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }

  function stopPermissionPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
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
    stopPermissionPolling()
    clearTokens()
    user.value = null
    isAuthenticated.value = false
    role.value = SystemRole.User
    setActiveProject('')
    projectStore.clear()
  }

  return { user, isAuthenticated, role, projectRole, activeProjectSlug, activeProjectName, setActiveProject, init, login, register, logout, refreshPermissions }
})
