<template>
  <div>
    <div class="page-header"><h2>{{ isEdit ? '编辑配置' : '新建配置' }}</h2></div>
    <el-form :model="form" label-width="100px" style="max-width:700px">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="引用模板">
        <el-select v-model="form.templateId" clearable placeholder="可选" style="width:100%">
          <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="覆盖配置 (JSON)">
        <el-input v-model="overrideStr" type="textarea" :rows="12" placeholder="输入JSON覆盖配置..." />
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
import { createConfig, getConfig, updateConfig, getTemplates } from '@/api/layout'
import type { LayoutTemplate } from '@/types/models'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const configId = computed(() => route.params.configId as string)
const isEdit = computed(() => configId.value && configId.value !== 'new')
const saving = ref(false)
const templates = ref<LayoutTemplate[]>([])

const form = reactive({ name: '', templateId: '' as string | null })
const overrideStr = ref('{}')

onMounted(async () => {
  const { data: tRes } = await getTemplates(projectId.value)
  templates.value = tRes.data
  if (isEdit.value) {
    const { data: res } = await getConfig(projectId.value, configId.value)
    form.name = res.data.name
    form.templateId = res.data.templateId
    overrideStr.value = JSON.stringify(res.data.overrideConfig, null, 2)
  }
})

async function handleSave() {
  saving.value = true
  try {
    let override: any
    try { override = JSON.parse(overrideStr.value) } catch { ElMessage.error('JSON格式错误'); saving.value = false; return }

    const data = { name: form.name, templateId: form.templateId || undefined, overrideConfig: override }
    if (isEdit.value) {
      await updateConfig(projectId.value, configId.value, data)
    } else {
      await createConfig(projectId.value, data)
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
