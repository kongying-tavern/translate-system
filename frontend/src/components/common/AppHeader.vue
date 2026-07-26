<script setup lang="ts">
import type { ApiKey, Project } from '@/types/models'
import { ArrowDown, Setting } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '@/api/client'
import { deleteProject, getProject, getProjects, updateProject } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import EmptyState from './EmptyState.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string | undefined)
const isProjectRoute = computed(() => route.path.startsWith('/projects/'))
const projectName = ref('')
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const switcherVisible = ref(false)
const searchProject = ref('')
const allProjects = ref<any[]>([])
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
      auth.setActiveProject(res.data.id, res.data.name, res.data.code)
    }
    catch {
      projectName.value = slug
    }
  }
  else {
    projectName.value = ''
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
      <el-button link type="primary" style="font-size:16px;font-weight:600;padding:0" @click="switcherVisible = true">
        {{ auth.activeProjectName || projectName }} <el-icon style="margin-left:4px">
          <ArrowDown />
        </el-icon>
      </el-button>
      <el-button v-if="auth.role === 'super_admin'" link style="margin-left:8px;padding:0" @click="settingsVisible = true">
        <el-icon><Setting /></el-icon>
      </el-button>
    </template>
  </div>
  <div class="header-right">
    <el-dropdown @command="handleCommand">
      <span class="user-info">{{ auth.user?.username }}<el-icon><ArrowDown /></el-icon></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="pwd">
            修改密码
          </el-dropdown-item>
          <el-dropdown-item v-if="auth.role !== 'member'" command="apikey">
            API 密钥
          </el-dropdown-item>
          <el-dropdown-item command="logout">
            退出登录
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <el-dialog v-model="switcherVisible" title="切换项目" width="550px">
    <el-input v-model="searchProject" placeholder="搜索项目..." style="margin-bottom:12px" />
    <div class="project-list">
      <div v-for="p in filteredProjects" :key="p.id" class="project-item" @click="switchProject(p)">
        <span class="project-name">{{ p.name }}</span><span v-if="p.code" class="project-code">[{{ p.code }}]</span><span class="project-lang">{{ p.description }}</span>
      </div>
    </div>
    <EmptyState v-if="!filteredProjects.length" description="暂无项目" />
    <template #footer>
      <el-button v-if="auth.role === 'super_admin'" type="primary" style="width:100%" @click="goCreateProject">
        新建项目
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="settingsVisible" title="项目设置" width="500px">
    <el-form :model="settingsForm" label-width="80px">
      <el-form-item label="名称">
        <el-input v-model="settingsForm.name" />
      </el-form-item>
      <el-form-item label="标识">
        <el-input v-model="settingsForm.code" placeholder="英文标识，如 my-project" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="settingsForm.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="danger" style="float:left" @click="handleDeleteProject">
        删除项目
      </el-button><el-button @click="settingsVisible = false">
        取消
      </el-button><el-button type="primary" :loading="settingsSaving" @click="saveSettings">
        保存
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="apikeyVisible" title="API 密钥" width="650px">
    <div style="margin-bottom:16px">
      <el-form :inline="true">
        <el-form-item><el-input v-model="newKeyName" placeholder="密钥名称" style="width:200px" /></el-form-item><el-form-item>
          <el-button type="primary" @click="createApiKey">
            生成新密钥
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <el-table :data="apiKeys" stripe>
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column prop="apiKey" label="API Key" min-width="180" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
            {{ row.enabled ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后使用" width="160">
        <template #default="{ row }">
          {{ row.lastUsed ? new Date(row.lastUsed).toLocaleString('zh-CN') : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button link size="small" @click="toggleApiKey(row)">
            {{ row.enabled ? '禁用' : '启用' }}
          </el-button><el-button link type="danger" size="small" @click="deleteApiKey(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="newSecret" style="margin-top:16px;background:#f0f9eb;border:1px solid #b7eb8f;padding:12px;border-radius:6px">
      <p style="color:#389e0d;font-weight:600;margin:0 0 4px">
        新密钥已生成！请立即复制 Secret，关闭后将无法再次查看：
      </p>
      <code style="word-break:break-all;font-size:13px">{{ newSecret }}</code>
    </div>
    <p style="margin-top:12px;font-size:13px;color:#909399">
      使用方式：请求头 <code>x-api-key</code> 和 <code>x-api-secret</code>
    </p>
  </el-dialog>

  <el-dialog v-model="pwdVisible" title="修改密码" width="400px">
    <el-form label-width="80px">
      <el-form-item label="当前密码">
        <el-input v-model="pwdForm.oldPassword" show-password />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="pwdForm.newPassword" show-password />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input v-model="pwdForm.confirmPassword" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdVisible = false">
        取消
      </el-button><el-button type="primary" @click="handlePwd">
        确认
      </el-button>
    </template>
  </el-dialog>
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
