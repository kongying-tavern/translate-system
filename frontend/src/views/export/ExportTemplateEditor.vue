<template>
  <div>
    <div class="page-header"><h2>{{ isEdit ? '编辑导出模板' : '新建导出模板' }}</h2></div>
    <el-form :model="form" label-width="100px" style="max-width:700px">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="模板标识"><el-input v-model="form.code" placeholder="英文标识，如 config-json" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
      <el-form-item label="输出格式">
        <el-select v-model="form.formatType" style="width:100%">
          <el-option label="扁平 JSON {Key: 译文}" value="flat-json" />
          <el-option label="嵌套 JSON {语言: {Key: 译文}}" value="json" />
          <el-option label="CSV" value="csv" />
          <el-option label="Properties" value="properties" />
          <el-option label="XML" value="xml" />
        </el-select>
      </el-form-item>
      <el-form-item label="配置">
        <div style="display:flex;flex-direction:column;gap:8px">
          <el-checkbox v-model="configForm.skipIdentical">跳过 Key 和译文相同的行（源语言）</el-checkbox>
          <el-checkbox v-model="configForm.skipEmpty">跳过译文为空的行</el-checkbox>
          <el-checkbox v-model="configForm.useCodeKey">使用原始语言 Code（不应用别名）</el-checkbox>
        </div>
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
import { createExportTemplate, getExportTemplate, updateExportTemplate } from '@/api/export'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const templateId = computed(() => route.params.templateId as string)
const isEdit = computed(() => templateId.value && templateId.value !== 'new')
const saving = ref(false)

const form = reactive({ name: '', code: '', description: '', formatType: 'json' })
const configForm = reactive({ skipIdentical: false, skipEmpty: false, useCodeKey: false })

onMounted(async () => {
  if (isEdit.value) {
    const { data: res } = await getExportTemplate(projectId.value, templateId.value)
    form.name = res.data.name
    form.code = res.data.code || ''
    form.description = res.data.description || ''
    form.formatType = res.data.formatType
    if (res.data.config) { configForm.skipIdentical = !!res.data.config.skipIdentical; configForm.skipEmpty = !!res.data.config.skipEmpty; configForm.useCodeKey = !!res.data.config.useCodeKey }
  }
})

async function handleSave() {
  saving.value = true
  try {
    const config = { ...configForm }
    const data = { ...form, config }
    if (isEdit.value) {
      await updateExportTemplate(projectId.value, templateId.value, data)
    } else {
      await createExportTemplate(projectId.value, data)
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
