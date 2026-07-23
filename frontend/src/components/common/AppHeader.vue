<template>
  <div class="header-left">
    <template v-if="isProjectRoute && projectId">
      <el-button link type="primary" @click="switcherVisible = true" style="font-size:16px;font-weight:600;padding:0">
        {{ auth.activeProjectName || projectName }} <el-icon style="margin-left:4px"><ArrowDown /></el-icon>
      </el-button>
      <el-button v-if="auth.role === 'super_admin'" link style="margin-left:8px;padding:0" @click="settingsVisible = true"><el-icon><Setting /></el-icon></el-button>
    </template>
  </div>
  <div class="header-right">
    <el-dropdown @command="handleCommand">
      <span class="user-info">{{ auth.user?.username }}<el-icon><ArrowDown /></el-icon></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="pwd">修改密码</el-dropdown-item>
          <el-dropdown-item command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <el-dialog v-model="switcherVisible" title="切换项目" width="550px">
    <el-input v-model="searchProject" placeholder="搜索项目..." style="margin-bottom:12px" />
    <div class="project-list">
      <div v-for="p in filteredProjects" :key="p.id" class="project-item" @click="switchProject(p)">
        <span class="project-name">{{ p.name }}</span><span class="project-lang">{{ p.description }}</span>
      </div>
    </div>
    <EmptyState v-if="!filteredProjects.length" description="暂无项目" />
    <template #footer>
      <el-button v-if="auth.role === 'super_admin'" type="primary" @click="goCreateProject" style="width:100%">新建项目</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="settingsVisible" title="项目设置" width="500px">
    <el-form :model="settingsForm" label-width="80px">
      <el-form-item label="名称"><el-input v-model="settingsForm.name" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="settingsForm.description" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer><el-button type="danger" @click="handleDeleteProject" style="float:left">删除项目</el-button><el-button @click="settingsVisible=false">取消</el-button><el-button type="primary" @click="saveSettings" :loading="settingsSaving">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="pwdVisible" title="修改密码" width="400px">
    <el-form label-width="80px">
      <el-form-item label="当前密码"><el-input v-model="pwdForm.oldPassword" show-password /></el-form-item>
      <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" show-password /></el-form-item>
    </el-form>
    <template #footer><el-button @click="pwdVisible=false">取消</el-button><el-button type="primary" @click="handlePwd">确认</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Setting } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getProject, getProjects, updateProject, deleteProject } from '@/api/project'
import client from '@/api/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from './EmptyState.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const projectId = computed(() => route.params.projectId as string | undefined)
const isProjectRoute = computed(() => route.path.startsWith('/projects/'))
const projectName = ref('')
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '' })
const switcherVisible = ref(false)
const searchProject = ref('')
const allProjects = ref<any[]>([])
const settingsVisible = ref(false)
const settingsSaving = ref(false)
const settingsForm = reactive({ name: '', description: '' })

function handleCommand(cmd: string) {
  if (cmd === 'logout') { auth.logout(); router.push('/auth/login') }
  if (cmd === 'pwd') { pwdForm.oldPassword = ''; pwdForm.newPassword = ''; pwdVisible.value = true }
}

async function handlePwd() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) { ElMessage.warning('请填写完整'); return }
  try { await client.put('/auth/me/password', pwdForm); pwdVisible.value = false; ElMessage.success('密码已修改，请重新登录'); auth.logout(); router.push('/auth/login') } catch (e: any) { ElMessage.error(e.response?.data?.message || '修改失败') }
}

const filteredProjects = computed(() => {
  if (!searchProject.value) return allProjects.value
  const q = searchProject.value.toLowerCase()
  return allProjects.value.filter((p: any) => p.name.toLowerCase().includes(q))
})

watch(projectId, async (id) => {
  if (id) { try { const { data: res } = await getProject(id); projectName.value = res.data.name; auth.setActiveProject(id, res.data.name) } catch { projectName.value = id } }
  else { projectName.value = '' }
}, { immediate: true })

watch(switcherVisible, async (v) => {
  if (v) { searchProject.value = ''; try { const { data: res } = await getProjects(1, 100); allProjects.value = res.data.list } catch {} }
})

watch(settingsVisible, async (v) => {
  if (v && projectId.value) {
    try { const { data: res } = await getProject(projectId.value); Object.assign(settingsForm, { name: res.data.name, description: res.data.description || '' }) } catch {}
  }
})

function switchProject(p: any) {
  switcherVisible.value = false
  // Keep current sub-page
  const suffix = projectId.value ? route.path.split(projectId.value)[1] || '/translations' : ''
  router.push('/projects/' + p.id + suffix)
}
function goCreateProject() { switcherVisible.value = false; router.push('/projects/new') }

async function handleDeleteProject() {
  try { await ElMessageBox.confirm('确定要删除项目「' + projectName.value + '」吗？该操作不可恢复。', '危险操作', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' }) } catch { return }
  try { await deleteProject(projectId.value!); settingsVisible.value = false; localStorage.removeItem('activeProjectId'); localStorage.removeItem('activeProjectName'); router.push('/'); ElMessage.success('项目已删除') } catch { ElMessage.error('删除失败') }
}

async function saveSettings() {
  if (!settingsForm.name.trim()) { ElMessage.warning('名称不能为空'); return }
  settingsSaving.value = true
  try { await updateProject(projectId.value!, { name: settingsForm.name, description: settingsForm.description }); settingsVisible.value = false; projectName.value = settingsForm.name; auth.setActiveProject(projectId.value!, settingsForm.name); ElMessage.success('已保存') } catch { ElMessage.error('保存失败') }
  finally { settingsSaving.value = false }
}
</script>

<style scoped>
.header-left { flex: 1; display: flex; align-items: center; }
.header-right { display: flex; align-items: center; }
.user-info { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.project-list { max-height: 350px; overflow-y: auto; }
.project-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; cursor: pointer; }
.project-item:hover { background: #f5f7fa; }
.project-name { font-weight: 500; }
.project-lang { font-size: 12px; color: #909399; }
</style>
