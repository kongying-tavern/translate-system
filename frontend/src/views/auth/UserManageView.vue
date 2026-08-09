<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { User } from '@/types/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { changePassword, createUser, deleteUser, getUsers, updateUserRole } from '@/api/auth'
import { BaseButton, BaseDialog, BaseForm, BaseFormItem, BaseInput, BaseLink, BasePageHeader, BaseSelect, BaseTable, BaseTag } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { roleLabel, SystemRole } from '@/utils/roles'

const auth = useAuthStore()
const users = ref<User[]>([])
const createVisible = ref(false)
const createForm = reactive({ username: '', email: '', password: '', role: SystemRole.User })
const pwdVisible = ref(false)
const pwdTarget = ref<User | null>(null)
const pwdForm = reactive({ password: '', confirmPassword: '' })

onMounted(async () => {
  const { data: res } = await getUsers()
  users.value = res.data
})

function cannotEdit(row: User) {
  if (row.id === auth.user?.id)
    return true
  if (row.role === SystemRole.SuperAdmin)
    return true
  return false
}

async function onChangeRole(row: User, newRole: string) {
  try {
    await updateUserRole(row.id, newRole)
    row.role = newRole
    ElMessage.success('已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败')
  }
}
function openCreate() {
  Object.assign(createForm, { username: '', email: '', password: '', role: SystemRole.User })
  createVisible.value = true
}
async function handleCreate() {
  if (!createForm.username || !createForm.email || !createForm.password) {
    ElMessage.warning('请填写完整')
    return
  }
  if (createForm.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  try {
    const { data: res } = await createUser({ ...createForm })
    users.value.push(res.data)
    createVisible.value = false
    ElMessage.success('已添加')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败')
  }
}
async function handleDelete(row: User) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.username} 吗？`, '确认', { type: 'warning' })
  }
  catch {
    return
  }
  try {
    await deleteUser(row.id)
    users.value = users.value.filter(u => u.id !== row.id)
    ElMessage.success('已删除')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败')
  }
}
function openPwd(row: User) {
  pwdTarget.value = row
  pwdForm.password = ''
  pwdForm.confirmPassword = ''
  pwdVisible.value = true
}
async function handlePwdSave() {
  if (!pwdForm.password || !pwdForm.confirmPassword) {
    ElMessage.warning('请填写完整')
    return
  }
  if (pwdForm.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  if (pwdForm.password !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  if (!pwdTarget.value)
    return
  try {
    await changePassword(pwdTarget.value.id, pwdForm.password)
    pwdVisible.value = false
    ElMessage.success('已修改')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '失败')
  }
}

const userColumns: BaseTableColumnConfig<User>[] = [
  { dataKey: 'username', title: '用户名', width: 150 },
  { dataKey: 'email', title: '邮箱', width: 250 },
  {
    title: '系统角色',
    width: 180,
    cell: (row) => {
      if (cannotEdit(row))
        return <BaseTag type="info">{roleLabel(row.role)}</BaseTag>
      return (
        <BaseSelect modelValue={row.role} size="small" style={{ width: '130px' }} onChange={(v: unknown) => onChangeRole(row, v as string)}>
          <el-option label="管理员" value="admin" />
          <el-option label="普通用户" value={SystemRole.User} />
        </BaseSelect>
      )
    },
  },
  {
    title: '注册时间',
    minWidth: 170,
    cell: row => formatDate(row.createdAt),
  },
  {
    title: '操作',
    width: 200,
    cell: row => (
      <div>
        <BaseLink type="primary" size="small" underline={false} disabled={cannotEdit(row) && row.id !== auth.user?.id} onClick={() => openPwd(row)}>改密</BaseLink>
        <BaseLink type="danger" size="small" underline={false} disabled={cannotEdit(row)} onClick={() => handleDelete(row)}>删除</BaseLink>
      </div>
    ),
  },
]
</script>

<template>
  <div>
    <BasePageHeader title="用户管理">
      <template #extra>
        <BaseButton v-if="auth.role === SystemRole.SuperAdmin || auth.role === SystemRole.Admin" type="primary" @click="openCreate">
          添加用户
        </BaseButton>
      </template>
    </BasePageHeader>
    <BaseTable :data="users" :columns="userColumns" stripe />
    <BaseDialog v-model="createVisible" title="添加用户" width="450px">
      <BaseForm label-width="80px" class="dialog-form">
        <BaseFormItem label="用户名">
          <BaseInput v-model="createForm.username" />
        </BaseFormItem><BaseFormItem label="邮箱">
          <BaseInput v-model="createForm.email" />
        </BaseFormItem><BaseFormItem label="密码">
          <BaseInput v-model="createForm.password" show-password />
        </BaseFormItem><BaseFormItem label="角色">
          <BaseSelect v-model="createForm.role" style="width:100%">
            <el-option class="base-option" label="管理员" value="admin" /><el-option class="base-option" label="普通用户" :value="SystemRole.User" />
          </BaseSelect>
        </BaseFormItem>
      </BaseForm>
      <template #footer>
        <BaseButton @click="createVisible = false">
          取消
        </BaseButton><BaseButton type="primary" @click="handleCreate">
          确认添加
        </BaseButton>
      </template>
    </BaseDialog>
    <BaseDialog v-model="pwdVisible" title="修改密码" width="400px">
      <BaseForm label-width="100px" class="dialog-form">
        <BaseFormItem label="用户">
          {{ pwdTarget?.username }}
        </BaseFormItem><BaseFormItem label="新密码">
          <BaseInput v-model="pwdForm.password" show-password />
        </BaseFormItem><BaseFormItem label="确认密码">
          <BaseInput v-model="pwdForm.confirmPassword" show-password />
        </BaseFormItem>
      </BaseForm>
      <template #footer>
        <BaseButton @click="pwdVisible = false">
          取消
        </BaseButton><BaseButton type="primary" @click="handlePwdSave">
          确认
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
