<script setup lang="ts">
import type { ProjectMember, User } from '@/types/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getUsers } from '@/api/auth'
import client from '@/api/client'
import { addMember, getMembers, removeMember } from '@/api/project'
import EmptyState from '@/components/common/EmptyState.vue'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/utils/roles'

const auth = useAuthStore()
const perm = useProjectPermission()
const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const members = ref<ProjectMember[]>([])
const selectedUserId = ref('')
const newMemberRole = ref('member')
const userOptions = ref<User[]>([])
const searching = ref(false)

onMounted(async () => {
  const { data: res } = await getMembers(projectSlug.value)
  members.value = res.data
})

async function searchUsers(q: string) {
  if (!q) {
    userOptions.value = []
    return
  }
  searching.value = true
  try {
    const { data: res } = await getUsers()
    userOptions.value = res.data.filter(u => u.username.includes(q) || u.email.includes(q)).slice(0, 10)
  }
  catch {}
  finally { searching.value = false }
}

async function handleAdd(userId: string) {
  if (!userId)
    return
  const u = userOptions.value.find(o => o.id === userId)
  if (!u)
    return
  try {
    const { data: res } = await addMember(projectSlug.value, u.email, newMemberRole.value)
    members.value.push(res.data)
    selectedUserId.value = ''
    userOptions.value = []
    ElMessage.success('已添加')
  }
  catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败') }
}

async function handleRemove(row: ProjectMember) {
  try {
    await ElMessageBox.confirm(`确定将 ${row.username} 移出项目吗？`, '确认移除', { confirmButtonText: '确认移除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  try {
    await removeMember(projectSlug.value, row.id)
    members.value = members.value.filter(m => m.id !== row.id)
    ElMessage.success('已移除')
  }
  catch { ElMessage.error('失败') }
}

async function changeProjectRole(row: ProjectMember, newRole: string) {
  try {
    await client.put(`/projects/${projectSlug.value}/members/${row.id}/role`, { projectRole: newRole })
    row.projectRole = newRole
    ElMessage.success('已更新')
  }
  catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败') }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>项目成员</h2>
    </div>
    <el-form v-if="perm.canManageProject.value" :inline="true" class="add-bar">
      <el-form-item label="添加成员">
        <el-select
          v-model="selectedUserId" filterable remote :remote-method="searchUsers" :loading="searching"
          placeholder="输入用户名或邮箱搜索" style="width:280px" clearable @change="handleAdd"
        >
          <el-option v-for="u in userOptions" :key="u.id" :label="`${u.username} (${u.email}) - ${roleLabel(u.role)}`" :value="u.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="项目角色">
        <el-select v-model="newMemberRole" style="width:120px">
          <el-option label="管理员" value="admin" /><el-option label="维护者" value="maintainer" /><el-option label="成员" value="member" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-table :data="members" stripe>
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="240" />
      <el-table-column label="系统角色" width="100">
        <template #default="{ row }">
          {{ roleLabel(row.role) }}
        </template>
      </el-table-column>
      <el-table-column label="项目角色" width="130">
        <template #default="{ row }">
          <el-select v-model="row.projectRole" size="small" style="width:100px" :disabled="row.userId === auth.user?.id || !perm.canManageProject.value" @change="(v:string) => changeProjectRole(row, v)">
            <el-option label="管理员" value="admin" /><el-option label="维护者" value="maintainer" /><el-option label="成员" value="member" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="加入时间" min-width="160">
        <template #default="{ row }">
          {{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ row }">
          <el-button v-if="perm.canManageProject.value" link type="danger" size="small" @click="handleRemove(row)">
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <EmptyState v-if="!members.length" description="暂无项目成员" />
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 20px; } .page-header h2 { margin: 0; }
.add-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.add-bar .el-form-item { margin-bottom: 0; }
</style>
