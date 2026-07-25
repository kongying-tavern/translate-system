<template>
  <div>
    <div class="page-header"><h2>导入模板</h2><el-button type="primary" @click="$router.push('/projects/'+projectSlug+'/imports/new/edit')">新建模板</el-button></div>

    <el-form :inline="true" class="import-bar" v-if="templates.length">
      <el-form-item label="选择模板"><el-select v-model="selectedTemplate" placeholder="选择导入模板" style="width:220px"><el-option v-for="t in templates" :key="t.id" :label="t.name + ' (' + t.formatType + ')'" :value="t.id" /></el-select></el-form-item>
      <el-form-item label="目标语言"><el-select v-model="importLang" placeholder="选择语言" style="width:180px"><el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.alias || l.languageCode" :value="l.languageCode" /></el-select></el-form-item>
      <el-form-item><el-checkbox v-model="entriesOnly">仅导入条目（不导入译文）</el-checkbox></el-form-item>
      <el-form-item><el-upload :auto-upload="false" :show-file-list="false" accept=".json,.csv" @change="onFileChange"><el-button>选择文件</el-button></el-upload></el-form-item>
      <el-form-item><el-button type="primary" @click="doImport" :loading="importing">导入</el-button></el-form-item>
    </el-form>
    <div v-if="importFile" style="margin-bottom:12px;font-size:13px;color:#909399">已选文件: {{ importFile.name }}</div>

    <el-table :data="templates" stripe style="margin-top:16px">
      <el-table-column prop="name" label="模板名称" /><el-table-column prop="formatType" label="格式" width="150" /><el-table-column prop="description" label="描述" />
      <el-table-column label="操作" width="150"><template #default="{row}"><el-button link type="primary" @click="$router.push('/projects/'+projectSlug+'/imports/'+row.id+'/edit')">编辑</el-button><el-button link type="danger" @click="handleDelete(row.id)">删除</el-button></template></el-table-column>
    </el-table>
    <EmptyState v-if="!templates.length" description="暂无导入模板" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import EmptyState from '@/components/common/EmptyState.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const templates = ref<any[]>([])
const projectLanguages = ref<any[]>([])
const selectedTemplate = ref(''), importLang = ref(''), entriesOnly = ref(false), importing = ref(false)
const importFile = ref<File | null>(null)

onMounted(async () => {
  const [tRes, lRes] = await Promise.all([client.get('/projects/'+projectSlug.value+'/imports/templates'), client.get('/projects/'+projectSlug.value+'/languages')])
  templates.value = tRes.data.data; projectLanguages.value = lRes.data.data
  if (templates.value.length) selectedTemplate.value = templates.value[0].id
  if (projectLanguages.value.length) importLang.value = projectLanguages.value[0].languageCode
})

function onFileChange(file: any) { importFile.value = file.raw }

async function doImport() {
  if (!selectedTemplate.value || !importFile.value || !importLang.value) { ElMessage.warning('请选择模板、语言和文件'); return }
  importing.value = true
  try {
    const text = await importFile.value.text()
    const data = JSON.parse(text)
    const { data: res } = await client.post('/projects/'+projectSlug.value+'/imports/execute', {
      templateId: selectedTemplate.value, languageCode: importLang.value, data, entriesOnly: entriesOnly.value
    })
    ElMessage.success('导入完成: ' + res.data.imported + ' 条')
    importFile.value = null
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '导入失败') }
  finally { importing.value = false }
}

async function handleDelete(id: string) {
  await client.delete('/projects/'+projectSlug.value+'/imports/templates/'+id)
  templates.value = templates.value.filter(t => t.id !== id); ElMessage.success('已删除')
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } .page-header h2 { margin: 0; }
.import-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.import-bar .el-form-item { margin-bottom: 0; }
</style>
