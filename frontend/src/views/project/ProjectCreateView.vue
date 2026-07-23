<template>
  <div>
    <div class="page-header"><h2>新建项目</h2></div>
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" style="max-width:600px">
      <el-form-item label="项目名称" prop="name"><el-input v-model="form.name" placeholder="请输入项目名称" /></el-form-item>
      <el-form-item label="项目描述"><el-input v-model="form.description" type="textarea" placeholder="项目描述(可选)" /></el-form-item>
      <el-form-item><el-button type="primary" @click="handleCreate" :loading="loading">创建</el-button><el-button @click="$router.push('/')">取消</el-button></el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { ElMessage } from 'element-plus'

const router = useRouter()
const store = useProjectStore()
const loading = ref(false)
const form = reactive({ name: '', description: '', sourceLanguage: 'en' })
const rules = { name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }] }

async function handleCreate() {
  loading.value = true
  try { const p = await store.create(form.name, form.description, form.sourceLanguage); ElMessage.success('项目创建成功'); router.push('/projects/' + p.id) } catch { ElMessage.error('创建失败') }
  finally { loading.value = false }
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; } .page-header h2 { margin: 0; }
</style>
