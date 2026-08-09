<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { ApiKey, Project } from '@/types/models'
import { ArrowDown, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '@/api/client'
import { BaseButton, BaseDialog, BaseForm, BaseFormItem, BaseIcon, BaseInput, BaseLink, BaseTable, BaseTag } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { decPathParam, encPathParam } from '@/utils/path'
import EmptyState from './EmptyState.vue'

const auth = useAuthStore()
const projectStore = useProjectStore()
const perm = useProjectPermission()
const router = useRouter()
const route = useRoute()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string | undefined))
const isProjectRoute = computed(() => route.path.startsWith('/projects/'))
const isEditRoute = computed(() => route.name === 'ProjectEdit')
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const switcherVisible = ref(false)
const searchProject = ref('')

// ── API Keys ──
const apikeyVisible = ref(false)
const apiKeys = ref<ApiKey[]>([])
const newKeyName = ref('')
const newSecret = ref('')

async function loadApiKeys() {
  try {
    const { data: res } = await client.get('/me/keys')
    apiKeys.value = res.data
  }
  catch {}
}

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout()
    router.push('/auth/login')
  }
  if (cmd === 'pwd') {
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    pwdVisible.value = true
  }
  if (cmd === 'apikey') {
    loadApiKeys()
    apikeyVisible.value = true
  }
}

async function handlePwd() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
    ElMessage.warning('请填写完整')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  try {
    const res = await client.put('/auth/me/password', { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    if (res.data.code !== 0) {
      ElMessage.error(res.data.message || '修改失败')
      return
    }
    pwdVisible.value = false
    ElMessage.success('密码已修改，请重新登录')
    auth.logout()
    router.push('/auth/login')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '修改失败')
  }
}

const filteredProjects = computed(() => {
  if (!searchProject.value)
    return projectStore.projects
  const q = searchProject.value.toLowerCase()
  return projectStore.projects.filter(p => p.name.toLowerCase().includes(q))
})

watch(projectSlug, (slug) => {
  if (slug)
    auth.setActiveProject(slug)
}, { immediate: true })

watch(switcherVisible, async (v) => {
  if (v) {
    searchProject.value = ''
    try {
      await projectStore.fetchProjects(true)
    }
    catch {}
  }
})

function switchProject(p: Project) {
  switcherVisible.value = false
  const slug = p.code || p.id
  router.push(`/projects/${encPathParam(slug)}/translations`)
}
function goCreateProject() {
  switcherVisible.value = false
  router.push('/projects/new')
}

function goEditProject() {
  if (!projectSlug.value)
    return
  router.push(`/projects/${encPathParam(projectSlug.value)}/edit`)
}

const apikeyColumns: BaseTableColumnConfig<ApiKey>[] = [
  { dataKey: 'name', title: '名称', width: 120 },
  { dataKey: 'apiKey', title: 'API Key', minWidth: 180 },
  {
    title: '状态',
    width: 80,
    cell: row => <BaseTag type={row.enabled ? 'success' : 'danger'} size="small">{row.enabled ? '启用' : '禁用'}</BaseTag>,
  },
  {
    title: '最后使用',
    width: 160,
    cell: row => row.lastUsed ? new Date(row.lastUsed).toLocaleString('zh-CN') : '-',
  },
  {
    title: '操作',
    width: 140,
    cell: row => (
      <div>
        <BaseLink size="small" underline={false} onClick={() => toggleApiKey(row)}>{row.enabled ? '禁用' : '启用'}</BaseLink>
        <BaseLink type="danger" size="small" underline={false} onClick={() => deleteApiKey(row)}>删除</BaseLink>
      </div>
    ),
  },
]

async function createApiKey() {
  if (!newKeyName.value.trim()) {
    ElMessage.warning('请输入名称')
    return
  }
  try {
    const { data: res } = await client.post('/me/keys', { name: newKeyName.value.trim() })
    apiKeys.value.unshift(res.data)
    newSecret.value = res.data.secret
    newKeyName.value = ''
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '创建失败')
  }
}
function goApiDoc() {
  apikeyVisible.value = false
  router.push('/api-doc')
}
async function toggleApiKey(row: ApiKey) {
  try {
    await client.put(`/me/keys/${encPathParam(row.id)}`, { enabled: !row.enabled })
    row.enabled = !row.enabled
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '操作失败')
  }
}
async function deleteApiKey(row: ApiKey) {
  try {
    await ElMessageBox.confirm('删除后使用该 Key 的调用将立即失效，确定删除吗？', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  try {
    await client.delete(`/me/keys/${encPathParam(row.id)}`)
    apiKeys.value = apiKeys.value.filter(k => k.id !== row.id)
    ElMessage.success('已删除')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '删除失败')
  }
}
</script>

<template>
  <div class="header-left">
    <template v-if="isProjectRoute && projectSlug">
      <div class="project-switcher" @click="switcherVisible = true">
        {{ auth.activeProjectName || projectSlug }} <BaseIcon style="margin-left:4px">
          <ArrowDown />
        </BaseIcon>
      </div>
      <BaseLink v-if="perm.canEditProject.value && !isEditRoute" :underline="false" style="margin-left:8px;padding:2px" title="编辑" @click="goEditProject">
        <BaseIcon size="18">
          <Edit />
        </BaseIcon>
      </BaseLink>
    </template>
  </div>
  <div class="header-right">
    <el-dropdown @command="handleCommand">
      <span class="user-info">{{ auth.user?.username }}<BaseIcon><ArrowDown /></BaseIcon></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="pwd">
            修改密码
          </el-dropdown-item>
          <el-dropdown-item command="apikey">
            API 密钥
          </el-dropdown-item>
          <el-dropdown-item command="logout">
            退出登录
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <BaseDialog v-model="switcherVisible" title="切换项目" width="550px">
    <BaseInput v-model="searchProject" placeholder="搜索项目..." style="margin-bottom:12px" />
    <div class="project-list">
      <div v-for="p in filteredProjects" :key="p.id" class="project-item" @click="switchProject(p)">
        <span class="project-name">{{ p.name }}</span><span v-if="p.code" class="project-code">[{{ p.code }}]</span><span class="project-lang">{{ p.description }}</span>
      </div>
    </div>
    <EmptyState v-if="!filteredProjects.length" description="暂无项目" />
    <template #footer>
      <BaseButton v-if="perm.canCreateProject.value" type="primary" style="width:100%" @click="goCreateProject">
        新建项目
      </BaseButton>
    </template>
  </BaseDialog>

  <BaseDialog v-model="apikeyVisible" title="API 密钥" width="650px">
    <div style="margin-bottom:16px">
      <BaseForm :inline="true">
        <BaseFormItem><BaseInput v-model="newKeyName" placeholder="密钥名称" style="width:200px" /></BaseFormItem><BaseFormItem>
          <BaseButton type="primary" @click="createApiKey">
            生成新密钥
          </BaseButton>
        </BaseFormItem>
      </BaseForm>
    </div>
    <BaseTable :data="apiKeys" :columns="apikeyColumns" stripe />
    <div v-if="newSecret" style="margin-top:16px;background:#f0f9eb;border:1px solid #b7eb8f;padding:12px;border-radius:6px">
      <p style="color:#389e0d;font-weight:600;margin:0 0 4px">
        新密钥已生成！请立即复制 Secret，关闭后将无法再次查看：
      </p>
      <code style="word-break:break-all;font-size:13px">{{ newSecret }}</code>
    </div>
    <div style="margin-top:12px;font-size:13px;color:#909399;display:flex;align-items:center;justify-content:space-between">
      <span>使用方式：请求头 <code>x-api-key</code> 和 <code>x-api-secret</code></span>
      <BaseLink type="primary" :underline="false" style="font-size:13px" @click="goApiDoc">
        查看使用文档
      </BaseLink>
    </div>
  </BaseDialog>

  <BaseDialog v-model="pwdVisible" title="修改密码" width="400px">
    <BaseForm label-width="100px" class="dialog-form">
      <BaseFormItem label="当前密码">
        <BaseInput v-model="pwdForm.oldPassword" show-password />
      </BaseFormItem>
      <BaseFormItem label="新密码">
        <BaseInput v-model="pwdForm.newPassword" show-password />
      </BaseFormItem>
      <BaseFormItem label="确认新密码">
        <BaseInput v-model="pwdForm.confirmPassword" show-password />
      </BaseFormItem>
    </BaseForm>
    <template #footer>
      <BaseButton @click="pwdVisible = false">
        取消
      </BaseButton><BaseButton type="primary" @click="handlePwd">
        确认
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style lang="scss" scoped>
.header-left { flex: 1; display: flex; align-items: center; }
.header-right { display: flex; align-items: center; }
.user-info { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.project-switcher { font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; }
.project-list { max-height: 350px; overflow-y: auto; }
.project-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; cursor: pointer; gap: 8px; }
.project-item:hover { background: #f5f7fa; }
.project-name { font-weight: 500; }
.project-code { font-size: 12px; color: #409eff; font-family: monospace; }
.project-lang { font-size: 12px; color: #909399; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
</style>
