<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { ProjectMember, User } from '@/types/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getUsers } from '@/api/auth'
import client from '@/api/client'
import { addMember, getMembers, removeMember } from '@/api/project'
import EmptyState from '@/components/common/EmptyState.vue'
import { BaseButton, BaseForm, BaseFormItem, BasePageHeader, BaseSelect, BaseTable } from '@/components/ui'
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

const memberColumns: BaseTableColumnConfig<ProjectMember>[] = [
  { dataKey: 'username', title: '用户名', width: 120 },
  { dataKey: 'email', title: '邮箱', width: 240 },
  {
    title: '系统角色',
    width: 100,
    cell: row => roleLabel(row.role),
  },
  {
    title: '项目角色',
    width: 130,
    cell: row => (
      <BaseSelect
        modelValue={row.projectRole}
        size="small"
        style={{ width: '100px' }}
        disabled={row.userId === auth.user?.id || !perm.canManageProject.value}
        onChange={(v: unknown) => changeProjectRole(row, v as string)}
      >
        <el-option label="管理员" value="admin" />
        <el-option label="维护者" value="maintainer" />
        <el-option label="成员" value="member" />
      </BaseSelect>
    ),
  },
  {
    title: '加入时间',
    minWidth: 160,
    cell: row => row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-',
  },
  {
    title: '操作',
    width: 80,
    cell: row => perm.canManageProject.value
      ? (
          <BaseButton link type="danger" size="small" onClick={() => handleRemove(row)}>移除</BaseButton>
        )
      : null,
  },
]
</script>

<template>
  <div>
    <BasePageHeader title="项目成员" />
    <BaseForm v-if="perm.canManageProject.value" :inline="true" class="add-bar">
      <BaseFormItem label="添加成员">
        <BaseSelect
          v-model="selectedUserId" filterable remote :remote-method="searchUsers" :loading="searching"
          placeholder="输入用户名或邮箱搜索" style="width:280px" clearable @change="handleAdd"
        >
          <el-option v-for="u in userOptions" :key="u.id" class="base-option" :label="`${u.username} (${u.email}) - ${roleLabel(u.role)}`" :value="u.id" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="项目角色">
        <BaseSelect v-model="newMemberRole" style="width:120px">
          <el-option class="base-option" label="管理员" value="admin" /><el-option class="base-option" label="维护者" value="maintainer" /><el-option class="base-option" label="成员" value="member" />
        </BaseSelect>
      </BaseFormItem>
    </BaseForm>

    <BaseTable :data="members" :columns="memberColumns" stripe />
    <EmptyState v-if="!members.length" description="暂无项目成员" />
  </div>
</template>

<style lang="scss" scoped>
.add-bar { padding: 16px; margin-bottom: 16px; }
</style>
