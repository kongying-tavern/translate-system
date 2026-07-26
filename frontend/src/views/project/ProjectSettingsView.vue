<script setup lang="ts">
import type { ProjectLanguage } from '@/types/models'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProjectLanguages } from '@/api/language'
import { getProject, updateProject } from '@/api/project'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => route.params.projectSlug as string)
const projectLanguages = ref<ProjectLanguage[]>([])
const saving = ref(false)
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en' })

onMounted(async () => {
  const [pRes, lRes] = await Promise.all([getProject(projectSlug.value), getProjectLanguages(projectSlug.value)])
  form.name = pRes.data.data.name
  form.code = pRes.data.data.code || ''
  form.description = pRes.data.data.description || ''
  form.sourceLanguage = pRes.data.data.sourceLanguage
  projectLanguages.value = lRes.data.data
})

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }
  saving.value = true
  try {
    await updateProject(projectSlug.value, { name: form.name, code: form.code, description: form.description, sourceLanguage: form.sourceLanguage })
    ElMessage.success('保存成功')
    router.back()
  }
  catch {
    ElMessage.error('保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>项目设置</h2>
    </div>
    <el-form :model="form" label-width="100px" style="max-width:600px">
      <el-form-item label="项目名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="项目标识">
        <el-input v-model="form.code" placeholder="英文标识，如 my-project" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="源语言">
        <el-select v-model="form.sourceLanguage" style="width:100%">
          <el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.languageCode" :value="l.languageCode" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>
