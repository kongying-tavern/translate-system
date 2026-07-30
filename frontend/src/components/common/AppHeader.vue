<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { ApiKey, Project } from '@/types/models'
import { ArrowDown, Setting } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '@/api/client'
import { deleteProject, getProject, getProjects, updateProject } from '@/api/project'
import { BaseButton, BaseDialog, BaseForm, BaseFormItem, BaseIcon, BaseInput, BaseTable } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import EmptyState from './EmptyState.vue'

const auth = useAuthStore()
const perm = useProjectPermission()
const router = useRouter()
const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string | undefined)
const isProjectRoute = computed(() => route.path.startsWith('/projects/'))
const projectName = ref('')
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const switcherVisible = ref(false)
const searchProject = ref('')
const allProjects = ref<Project[]>([])
const settingsVisible = ref(false)
const settingsSaving = ref(false)
const settingsForm = reactive({ name: '', code: '', description: '' })

// ── API Keys ──
const apikeyVisible = ref(false)
const apiKeys = ref<ApiKey[]>([])
const newKeyName = ref('')
const newSecret = ref('')

async function loadApiKeys() {
  try {
    const { data: res } = await client.get('/apikey/me/keys')
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
    return allProjects.value
  const q = searchProject.value.toLowerCase()
  return allProjects.value.filter(p => p.name.toLowerCase().includes(q))
})

watch(projectSlug, async (slug) => {
  if (slug) {
    try {
      const { data: res } = await getProject(slug)
      projectName.value = res.data.name
      auth.setActiveProject(res.data.id, res.data.name, res.data.code, res.data.projectRole)
    }
    catch {
      projectName.value = slug
    }
  }
  else {
    projectName.value = ''
    auth.setActiveProject('', '', undefined, null)
  }
}, { immediate: true })

watch(switcherVisible, async (v) => {
  if (v) {
    searchProject.value = ''
    try {
      const { data: res } = await getProjects(1, 100)
      allProjects.value = res.data.list
    }
    catch {}
  }
})

watch(settingsVisible, async (v) => {
  if (v && projectSlug.value) {
    try {
      const { data: res } = await getProject(projectSlug.value)
      Object.assign(settingsForm, { name: res.data.name, code: res.data.code || '', description: res.data.description || '' })
    }
    catch {}
  }
})

function switchProject(p: Project) {
  switcherVisible.value = false
  const slug = p.code || p.id
  const suffix = projectSlug.value ? route.path.split(projectSlug.value)[1] || '/translations' : ''
  router.push(`/projects/${slug}${suffix}`)
}
function goCreateProject() {
  switcherVisible.value = false
  router.push('/projects/new')
}

async function handleDeleteProject() {
  try {
    await ElMessageBox.confirm(`确定要删除项目「${projectName.value}」吗？该操作不可恢复。`, '危险操作', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch {
    return
  }
  try {
    await deleteProject(projectSlug.value!)
    settingsVisible.value = false
    localStorage.removeItem('activeProjectSlug')
    localStorage.removeItem('activeProjectName')
    router.push('/')
    ElMessage.success('项目已删除')
  }
  catch {
    ElMessage.error('删除失败')
  }
}

async function saveSettings() {
  if (!settingsForm.name.trim()) {
    ElMessage.warning('名称不能为空')
    return
  }
  settingsSaving.value = true
  try {
    await updateProject(projectSlug.value!, { name: settingsForm.name, code: settingsForm.code, description: settingsForm.description })
    settingsVisible.value = false
    projectName.value = settingsForm.name
    auth.setActiveProject(projectSlug.value!, settingsForm.name, settingsForm.code)
    ElMessage.success('已保存')
  }
  catch {
    ElMessage.error('保存失败')
  }
  finally {
    settingsSaving.value = false
  }
}

const apikeyColumns: BaseTableColumnConfig<ApiKey>[] = [
  { dataKey: 'name', title: '名称', width: 120 },
  { dataKey: 'apiKey', title: 'API Key', minWidth: 180 },
  {
    title: '状态',
    width: 80,
    cell: row => <ElTag type={row.enabled ? 'success' : 'danger'} size="small">{row.enabled ? '启用' : '禁用'}</ElTag>,
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
        <BaseButton link size="small" onClick={() => toggleApiKey(row)}>{row.enabled ? '禁用' : '启用'}</BaseButton>
        <BaseButton link type="danger" size="small" onClick={() => deleteApiKey(row)}>删除</BaseButton>
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
    const { data: res } = await client.post('/apikey/me/keys', { name: newKeyName.value.trim() })
    apiKeys.value.unshift(res.data)
    newSecret.value = res.data.secret
    newKeyName.value = ''
  }
  catch {
    ElMessage.error('创建失败')
  }
}
async function toggleApiKey(row: ApiKey) {
  try {
    await client.put(`/apikey/me/keys/${row.id}`, { enabled: !row.enabled })
    row.enabled = !row.enabled
  }
  catch {
    ElMessage.error('操作失败')
  }
}
async function deleteApiKey(row: ApiKey) {
  try {
    await ElMessageBox.confirm('删除后使用该 Key 的调用将立即失效，确定删除吗？', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  try {
    await client.delete(`/apikey/me/keys/${row.id}`)
    apiKeys.value = apiKeys.value.filter(k => k.id !== row.id)
    ElMessage.success('已删除')
  }
  catch {
    ElMessage.error('删除失败')
  }
}
</script>

<template>
  <div class="header-left">
    <template v-if="isProjectRoute && projectSlug">
      <BaseButton link type="primary" style="font-size:16px;font-weight:600;padding:0" @click="switcherVisible = true">
        {{ auth.activeProjectName || projectName }} <BaseIcon style="margin-left:4px">
          <ArrowDown />
        </BaseIcon>
      </BaseButton>
      <BaseButton v-if="perm.canEditProject.value" link style="margin-left:8px;padding:0" @click="settingsVisible = true">
        <BaseIcon><Setting /></BaseIcon>
      </BaseButton>
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

  <BaseDialog v-model="settingsVisible" title="项目设置" width="500px">
    <BaseForm :model="settingsForm" label-width="80px">
      <BaseFormItem label="名称">
        <BaseInput v-model="settingsForm.name" />
      </BaseFormItem>
      <BaseFormItem label="标识">
        <BaseInput v-model="settingsForm.code" placeholder="英文标识，如 my-project" />
      </BaseFormItem>
      <BaseFormItem label="描述">
        <BaseInput v-model="settingsForm.description" type="textarea" :rows="3" />
      </BaseFormItem>
    </BaseForm>
    <template #footer>
      <BaseButton type="danger" style="float:left" @click="handleDeleteProject">
        删除项目
      </BaseButton><BaseButton @click="settingsVisible = false">
        取消
      </BaseButton><BaseButton type="primary" :loading="settingsSaving" @click="saveSettings">
        保存
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
    <p style="margin-top:12px;font-size:13px;color:#909399">
      使用方式：请求头 <code>x-api-key</code> 和 <code>x-api-secret</code>
    </p>
  </BaseDialog>

  <BaseDialog v-model="pwdVisible" title="修改密码" width="400px">
    <BaseForm label-width="100px">
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

<style scoped>
.header-left { flex: 1; display: flex; align-items: center; }
.header-right { display: flex; align-items: center; }
.user-info { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.project-list { max-height: 350px; overflow-y: auto; }
.project-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; cursor: pointer; gap: 8px; }
.project-item:hover { background: #f5f7fa; }
.project-name { font-weight: 500; }
.project-code { font-size: 12px; color: #409eff; font-family: monospace; }
.project-lang { font-size: 12px; color: #909399; margin-left: auto; }
</style>
