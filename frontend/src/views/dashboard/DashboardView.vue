<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:#909399">加载中...</div>
  <div v-else-if="noProject" style="text-align:center;padding:80px 0">
    <p style="font-size:16px;color:#909399;margin-bottom:20px">暂无可用项目</p>
    <el-button v-if="auth.role === 'super_admin'" type="primary" @click="$router.push('/projects/new')">创建第一个项目</el-button>
    <p v-else style="font-size:14px;color:#c0c4cc">请联系管理员添加你为项目成员</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const store = useProjectStore()
const noProject = ref(false)
const loading = ref(true)

onMounted(async () => {
  await store.fetchProjects()
  loading.value = false
  if (store.projects.length > 0) {
    router.replace('/projects/' + store.projects[0].id)
  } else {
    noProject.value = true
    localStorage.removeItem('activeProjectId')
    localStorage.removeItem('activeProjectName')
  }
})
</script>
