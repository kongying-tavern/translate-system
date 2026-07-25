<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '@/api/client'

const route = useRoute(); const router = useRouter()
const projectSlug = computed(() => route.params.projectSlug as string)
const templateId = computed(() => route.params.templateId as string)
const isEdit = computed(() => templateId.value && templateId.value !== 'new')
const saving = ref(false); const form = reactive({ name: '', description: '', formatType: 'flat-json' })

onMounted(async () => {
  if (isEdit.value) {
    const { data: res } = await client.get(`/projects/${projectSlug.value}/imports/templates/${templateId.value}`)
    form.name = res.data.name; form.description = res.data.description || ''; form.formatType = res.data.formatType
  }
})

async function handleSave() {
  saving.value = true
  try {
    if (isEdit.value) { await client.put(`/projects/${projectSlug.value}/imports/templates/${templateId.value}`, { ...form }) }
    else { await client.post(`/projects/${projectSlug.value}/imports/templates`, { ...form }) }
    ElMessage.success('保存成功'); router.back()
  }
  catch { ElMessage.error('保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>{{ isEdit ? '编辑导入模板' : '新建导入模板' }}</h2>
    </div>
    <el-form :model="form" label-width="100px" style="max-width:700px">
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" />
      </el-form-item>
      <el-form-item label="输入格式">
        <el-select v-model="form.formatType" style="width:100%">
          <el-option label="扁平 JSON" value="flat-json" />
          <el-option label="嵌套 JSON" value="json" />
          <el-option label="CSV" value="csv" />
          <el-option label="Properties" value="properties" />
          <el-option label="XML" value="xml" />
          <el-option label="仅导入条目" value="entries-only" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button><el-button @click="$router.back()">
          取消
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 20px; } .page-header h2 { margin: 0; }
</style>
