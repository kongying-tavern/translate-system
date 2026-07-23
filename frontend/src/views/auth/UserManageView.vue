<template>
  <div>
    <div class="page-header">
      <h2>用户管理</h2>
      <el-button v-if="auth.role === 'super_admin' || auth.role === 'senior_admin'" type="primary" @click="openCreate">添加用户</el-button>
    </div>
    <el-table :data="users" stripe>
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="email" label="邮箱" width="250" />
      <el-table-column prop="role" label="角色" width="200">
        <template #default="{ row }">
          <el-tag v-if="cannotEdit(row)" type="info">{{ roleLabel(row.role) }}</el-tag>
          <el-select v-else :model-value="row.role" @change="(v: string) => onChangeRole(row, v)" size="small" style="width:150px">
            <el-option v-if="auth.role !== 'admin'" label="超级管理员" value="super_admin" />
            <el-option v-if="auth.role !== 'admin'" label="高级管理员" value="senior_admin" />
            <el-option label="管理员" value="admin" />
            <el-option label="成员" value="member" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openPwd(row)" :disabled="cannotEdit(row) && row.id !== auth.user?.id">改密</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)" :disabled="cannotEdit(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createVisible" title="添加用户" width="450px">
      <el-form label-width="80px">
        <el-form-item label="用户名"><el-input v-model="createForm.username" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="createForm.email" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="createForm.password" show-password /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width:100%">
            <el-option v-if="auth.role !== 'admin'" label="高级管理员" value="senior_admin" />
            <el-option label="管理员" value="admin" />
            <el-option label="成员" value="member" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="handleCreate">确认添加</el-button></template>
    </el-dialog>

    <el-dialog v-model="pwdVisible" title="修改密码" width="400px">
      <el-form label-width="80px">
        <el-form-item label="用户">{{ pwdTarget?.username }}</el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.password" show-password /></el-form-item>
      </el-form>
      <template #footer><el-button @click="pwdVisible = false">取消</el-button><el-button type="primary" @click="handlePwdSave">确认</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getUsers, updateUserRole, createUser, deleteUser, changePassword } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDate } from '@/utils/format'

const LEVEL: Record<string, number> = { super_admin: 4, senior_admin: 3, admin: 2, member: 1 }
const auth = useAuthStore()
const users = ref<any[]>([])
const createVisible = ref(false)
const createForm = reactive({ username: '', email: '', password: '', role: 'member' })
const pwdVisible = ref(false)
const pwdTarget = ref<any>(null)
const pwdForm = reactive({ password: '' })

onMounted(async () => { const { data: res } = await getUsers(); users.value = res.data })

function roleLabel(r: string) { return { super_admin: '超级管理员', senior_admin: '高级管理员', admin: '管理员', member: '成员' }[r] || r }

function cannotEdit(row: any) {
  if (row.id === auth.user?.id) return true
  const op = LEVEL[auth.role] || 0
  const tgt = LEVEL[row.role] || 0
  if (auth.role === 'senior_admin' && row.role === 'super_admin') return true
  if (auth.role === 'admin' && tgt >= 2) return true
  return false
}

async function onChangeRole(row: any, newRole: string) {
  try { await updateUserRole(row.id, newRole); row.role = newRole; ElMessage.success('角色已更新') } catch (e: any) { ElMessage.error(e.response?.data?.message || '更新失败') }
}

function openCreate() { Object.assign(createForm, { username: '', email: '', password: '', role: 'member' }); createVisible.value = true }

async function handleCreate() {
  if (!createForm.username || !createForm.email || !createForm.password) { ElMessage.warning('请填写完整'); return }
  try { const { data: res } = await createUser({ ...createForm }); users.value.push(res.data); createVisible.value = false; ElMessage.success('用户已添加') } catch (e: any) { ElMessage.error(e.response?.data?.message || '添加失败') }
}

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm('确定删除用户 ' + row.username + ' 吗？', '确认', { type: 'warning' }) } catch { return }
  try { await deleteUser(row.id); users.value = users.value.filter(u => u.id !== row.id); ElMessage.success('已删除') } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}

function openPwd(row: any) { pwdTarget.value = row; pwdForm.password = ''; pwdVisible.value = true }

async function handlePwdSave() {
  if (!pwdForm.password) { ElMessage.warning('请输入新密码'); return }
  try { await changePassword(pwdTarget.value.id, pwdForm.password); pwdVisible.value = false; ElMessage.success('密码已修改') } catch (e: any) { ElMessage.error(e.response?.data?.message || '修改失败') }
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>
