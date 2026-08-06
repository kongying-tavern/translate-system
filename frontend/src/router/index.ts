import type { RouteLocationGeneric } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { encPathParam } from '@/utils/path'
import { PROJECT_ROLE_LEVEL, SYS_ROLE_LEVEL, SystemRole } from '@/utils/roles'
import { getAccessToken } from '@/utils/token'

/**
 * 路由权限元数据：`sys:admin`（系统 admin+）/`sys:super_admin`（仅超管）/
 * `proj:admin`/`proj:maintainer`/`proj:member`（按 URL 项目角色，super_admin 恒放行）
 */
type RoutePerm = 'sys:admin' | 'sys:super_admin' | 'proj:admin' | 'proj:maintainer' | 'proj:member'

/** 校验当前用户是否有权进入目标路由（基于 meta.perm + 项目成员兜底） */
function hasRoutePermission(to: RouteLocationGeneric): boolean {
  const auth = useAuthStore()
  const slug = to.params.projectSlug as string | undefined
  const projectRole = slug ? useProjectStore().getProject(slug)?.projectRole ?? null : null

  // 兜底：项目内页面必须先满足「是该项目成员/owner 或 super_admin」，否则一律拒绝
  if (slug && auth.role !== SystemRole.SuperAdmin && !projectRole)
    return false

  const perm = to.meta.perm as RoutePerm | undefined
  if (!perm)
    return true

  const [kind, role] = perm.split(':')
  if (kind === 'sys')
    return (SYS_ROLE_LEVEL[auth.role] ?? 0) >= (SYS_ROLE_LEVEL[role] ?? 0)

  // proj:* — super_admin 恒放行，其余按 URL 项目角色门槛
  if (auth.role === SystemRole.SuperAdmin)
    return true
  return !!(projectRole && (PROJECT_ROLE_LEVEL[projectRole] ?? 0) >= (PROJECT_ROLE_LEVEL[role] ?? 0))
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/auth',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guest: true },
      redirect: '/login',
      children: [
        { path: 'login', name: 'Login', component: () => import('@/views/auth/LoginView.vue') },
        { path: 'register', name: 'Register', component: () => import('@/views/auth/RegisterView.vue') },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '项目管理', isStatic: true } },
        { path: 'users', name: 'Users', component: () => import('@/views/auth/UserManageView.vue'), meta: { title: '用户管理', perm: 'sys:admin' } },
        { path: 'api-doc', name: 'ApiDoc', component: () => import('@/views/auth/ApiDocView.vue'), meta: { title: '开放接口说明' } },
        { path: 'projects/new', name: 'ProjectCreate', component: () => import('@/views/project/ProjectCreateView.vue'), meta: { title: '新建项目', perm: 'sys:super_admin' } },
        {
          path: 'projects/:projectSlug',
          children: [
            { path: '', redirect: (to: RouteLocationGeneric) => `/projects/${encPathParam(to.params.projectSlug as string)}/translations` },
            { path: 'translations', name: 'Translations', component: () => import('@/views/translation/TranslationListView.vue'), meta: { title: '翻译管理', perm: 'proj:member' } },
            { path: 'languages', name: 'Languages', component: () => import('@/views/language/LanguageManageView.vue'), meta: { title: '语言管理', perm: 'proj:maintainer' } },
            { path: 'members', name: 'Members', component: () => import('@/views/project/ProjectMembersView.vue'), meta: { title: '项目成员', perm: 'proj:admin' } },
            { path: 'imports', name: 'Imports', component: () => import('@/views/import/ImportTemplateView.vue'), meta: { title: '导入管理', perm: 'proj:maintainer' } },
            { path: 'exports', name: 'Exports', component: () => import('@/views/export/ExportTemplateView.vue'), meta: { title: '导出模板', perm: 'proj:member' } },
            { path: 'exports/:templateId/edit', name: 'ExportTemplateEdit', component: () => import('@/views/export/ExportTemplateEditor.vue'), meta: { title: '编辑导出模板', perm: 'proj:maintainer' } },
          ],
        },
      ],
    },
  ],
})

let initDone = false
router.beforeEach(async (to, _from, next) => {
  const token = getAccessToken()
  if (token && !initDone) {
    initDone = true
    await useAuthStore().init()
  }
  if (to.meta.requiresAuth && !token) {
    next('/auth/login')
    return
  }
  if (to.meta.guest && token) {
    next('/')
    return
  }
  if (to.meta.requiresAuth && !hasRoutePermission(to)) {
    next('/')
    return
  }
  next()
})

export default router
