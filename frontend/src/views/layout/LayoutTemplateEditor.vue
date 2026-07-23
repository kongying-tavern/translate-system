<template>
  <div>
    <div class="page-header"><h2>{{ isEdit ? '编辑模板' : '新建模板' }}</h2></div>
    <el-form :model="form" label-width="100px" style="max-width:700px">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
      <el-form-item label="缩略图URL"><el-input v-model="form.thumbnailUrl" /></el-form-item>
      <el-form-item label="是否为默认"><el-switch v-model="form.isDefault" /></el-form-item>
      <el-form-item label="配置 (JSON)">
        <el-input v-model="configStr" type="textarea" :rows="12" placeholder="输入JSON配置..." />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createTemplate, getTemplate, updateTemplate } from '@/api/layout'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const templateId = computed(() => route.params.templateId as string)
const isEdit = computed(() => templateId.value && templateId.value !== 'new')
const saving = ref(false)

const form = reactive({ name: '', description: '', thumbnailUrl: '', isDefault: false })
const configStr = ref('{}')

onMounted(async () => {
  if (isEdit.value) {
    const { data: res } = await getTemplate(projectId.value, templateId.value)
    const t = res.data
    form.name = t.name
    form.description = t.description || ''
    form.thumbnailUrl = t.thumbnailUrl || ''
    form.isDefault = t.isDefault
    configStr.value = JSON.stringify(t.config, null, 2)
  }
})

async function handleSave() {
  saving.value = true
  try {
    let config: any
    try { config = JSON.parse(configStr.value) } catch { ElMessage.error('JSON格式错误'); saving.value = false; return }

    const data = { ...form, config }
    if (isEdit.value) {
      await updateTemplate(projectId.value, templateId.value, data)
    } else {
      await createTemplate(projectId.value, data)
    }
    ElMessage.success('保存成功')
    router.back()
  } catch { ElMessage.error('保存失败') }
  finally { saving.value = false }
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>
