import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '@/utils/token'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/auth', component: () => import('@/layouts/AuthLayout.vue'), meta: { guest: true },
      redirect: '/login',
      children: [
        { path: 'login', name: 'Login', component: () => import('@/views/auth/LoginView.vue') },
        { path: 'register', name: 'Register', component: () => import('@/views/auth/RegisterView.vue') },
      ],
    },
    {
      path: '/', component: () => import('@/layouts/AppLayout.vue'), meta: { requiresAuth: true },
      children: [
        { path: '', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardView.vue') },
        { path: 'users', name: 'Users', component: () => import('@/views/auth/UserManageView.vue') },
        { path: 'api-doc', name: 'ApiDoc', component: () => import('@/views/auth/ApiDocView.vue') },
        { path: 'projects/new', name: 'ProjectCreate', component: () => import('@/views/project/ProjectCreateView.vue') },
        {
          path: 'projects/:projectId', children: [
            { path: '', redirect: (to: any) => '/projects/' + to.params.projectId + '/translations' },
            { path: 'translations', name: 'Translations', component: () => import('@/views/translation/TranslationListView.vue') },
            { path: 'languages', name: 'Languages', component: () => import('@/views/language/LanguageManageView.vue') },
            { path: 'members', name: 'Members', component: () => import('@/views/project/ProjectMembersView.vue') },
            { path: 'exports', name: 'Exports', component: () => import('@/views/export/ExportTemplateView.vue') },
            { path: 'exports/:templateId/edit', name: 'ExportTemplateEdit', component: () => import('@/views/export/ExportTemplateEditor.vue') },
          ],
        },
      ],
    },
  ],
})

let initDone = false
router.beforeEach(async (to, _from, next) => {
  const token = getAccessToken()
  if (token && !initDone) { initDone = true; await useAuthStore().init() }
  if (to.meta.requiresAuth && !token) next('/auth/login')
  else if (to.meta.guest && token) next('/')
  else next()
})

export default router
