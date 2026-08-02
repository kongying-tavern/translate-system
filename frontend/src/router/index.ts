import type { RouteLocationGeneric } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/token'

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
        { path: 'users', name: 'Users', component: () => import('@/views/auth/UserManageView.vue'), meta: { title: '用户管理' } },
        { path: 'api-doc', name: 'ApiDoc', component: () => import('@/views/auth/ApiDocView.vue'), meta: { title: '开放接口说明' } },
        { path: 'projects/new', name: 'ProjectCreate', component: () => import('@/views/project/ProjectCreateView.vue'), meta: { title: '新建项目' } },
        {
          path: 'projects/:projectSlug',
          children: [
            { path: '', redirect: (to: RouteLocationGeneric) => `/projects/${to.params.projectSlug}/translations` },
            { path: 'translations', name: 'Translations', component: () => import('@/views/translation/TranslationListView.vue'), meta: { title: '翻译管理' } },
            { path: 'languages', name: 'Languages', component: () => import('@/views/language/LanguageManageView.vue'), meta: { title: '语言管理' } },
            { path: 'members', name: 'Members', component: () => import('@/views/project/ProjectMembersView.vue'), meta: { title: '项目成员' } },
            { path: 'imports', name: 'Imports', component: () => import('@/views/import/ImportTemplateView.vue'), meta: { title: '导入管理' } },
            { path: 'exports', name: 'Exports', component: () => import('@/views/export/ExportTemplateView.vue'), meta: { title: '导出模板' } },
            { path: 'exports/:templateId/edit', name: 'ExportTemplateEdit', component: () => import('@/views/export/ExportTemplateEditor.vue'), meta: { title: '编辑导出模板' } },
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
  if (to.meta.requiresAuth && !token)
    next('/auth/login')
  else if (to.meta.guest && token)
    next('/')
  else next()
})

export default router
