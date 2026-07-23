<template>
  <div>
    <div class="page-header"><h2>项目成员</h2></div>

    <el-form :inline="true" class="add-bar">
      <el-form-item label="添加成员">
        <el-select v-model="selectedUserId" filterable remote :remote-method="searchUsers" :loading="searching"
          placeholder="输入用户名或邮箱搜索" style="width:340px" clearable @change="handleAdd">
          <el-option v-for="u in userOptions" :key="u.id" :label="u.username + ' (' + u.email + ') - ' + roleLabel(u.role)" :value="u.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-table :data="members" stripe>
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="240" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">{{ roleLabel(row.role) }}</template>
      </el-table-column>
      <el-table-column label="加入时间" min-width="160">
        <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="handleRemove(row)" :disabled="(auth.role === 'admin' && row.role !== 'member') || (auth.role === 'senior_admin' && row.role === 'super_admin')">移除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyState v-if="!members.length" description="暂无项目成员" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getMembers, addMember, removeMember } from '@/api/project'
import { getUsers } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import EmptyState from '@/components/common/EmptyState.vue'
import { ElMessage } from 'element-plus'

const auth = useAuthStore()
const loadingStore = useLoadingStore()
const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const members = ref<any[]>([])
const selectedUserId = ref('')
const userOptions = ref<any[]>([])
const searching = ref(false)

function roleLabel(r: string) { return { super_admin: '超级管理员', senior_admin: '高级管理员', admin: '管理员', member: '成员' }[r] || r }

onMounted(() => loadMembers())
watch(projectId, () => { if (projectId.value) loadMembers() })
async function loadMembers() { loadingStore.start(); try { const { data: res } = await getMembers(projectId.value); members.value = res.data } finally { loadingStore.stop() } }

async function searchUsers(q: string) {
  if (!q) { userOptions.value = []; return }
  searching.value = true
  try { const { data: res } = await getUsers(); userOptions.value = res.data.filter((u: any) => { if (auth.role === 'admin' && u.role !== 'member') return false; if (auth.role === 'senior_admin' && u.role === 'super_admin') return false; return u.username.includes(q) || u.email.includes(q) }).slice(0, 10) } catch {}
  finally { searching.value = false }
}

async function handleAdd(userId: string) {
  if (!userId) return
  const u = userOptions.value.find(o => o.id === userId)
  if (!u) return
  try { const { data: res } = await addMember(projectId.value, u.email); members.value.push(res.data); selectedUserId.value = ''; userOptions.value = []; ElMessage.success('已添加') } catch (e: any) { ElMessage.error(e.response?.data?.message || '添加失败') }
}

async function handleRemove(row: any) {
  try { await removeMember(projectId.value, row.id); members.value = members.value.filter(m => m.id !== row.id); ElMessage.success('已移除') } catch { ElMessage.error('移除失败') }
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.add-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.add-bar .el-form-item { margin-bottom: 0; }
</style>
