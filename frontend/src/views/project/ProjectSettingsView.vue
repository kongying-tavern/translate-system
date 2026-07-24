<template>
  <div>
    <div class="page-header"><h2>项目设置</h2></div>
    <el-form :model="form" label-width="100px" style="max-width:600px">
      <el-form-item label="项目名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="项目标识"><el-input v-model="form.code" placeholder="英文标识，如 my-project" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="源语言">
        <el-select v-model="form.sourceLanguage" style="width:100%">
          <el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.languageCode" :value="l.languageCode" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProject, updateProject } from '@/api/project'
import { getProjectLanguages } from '@/api/language'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const projectLanguages = ref<any[]>([])
const saving = ref(false)
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en' })

onMounted(async () => {
  const [pRes, lRes] = await Promise.all([getProject(projectId.value), getProjectLanguages(projectId.value)])
  form.name = pRes.data.data.name
  form.code = pRes.data.data.code || ''
  form.description = pRes.data.data.description || ''
  form.sourceLanguage = pRes.data.data.sourceLanguage
  projectLanguages.value = lRes.data.data
})

async function handleSave() {
  if (!form.name.trim()) { ElMessage.warning('项目名称不能为空'); return }
  saving.value = true
  try { await updateProject(projectId.value, { name: form.name, code: form.code, description: form.description, sourceLanguage: form.sourceLanguage }); ElMessage.success('保存成功'); router.back() } catch { ElMessage.error('保存失败') }
  finally { saving.value = false }
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>
