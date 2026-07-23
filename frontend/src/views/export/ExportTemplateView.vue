<template>
  <div>
    <div class="page-header">
      <h2>导出</h2>
      <el-button type="primary" @click="$router.push(`/projects/${projectId}/exports/new/edit`)">新建模板</el-button>
    </div>

    <template v-if="templates.length">
      <el-form :inline="true" class="export-bar">
        <el-form-item label="选择模板">
          <el-select v-model="selectedTemplate" placeholder="选择导出模板" style="width:220px">
            <el-option v-for="t in templates" :key="t.id" :label="t.name + ' (' + t.formatType + ')'" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="导出语言">
          <el-select v-model="selectedLangs" multiple placeholder="选择语言" style="width:280px">
            <el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.alias || l.languageCode" :value="l.languageCode" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="exportFilterTags" multiple clearable placeholder="按标签过滤(可选)" style="width:200px">
            <el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="doPreview">预览</el-button>
          <el-button type="success" @click="doDownload">下载导出</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="templates" stripe style="margin-top:16px">
        <el-table-column prop="name" label="模板名称" />
        <el-table-column prop="formatType" label="格式" width="150" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/projects/${projectId}/exports/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
    <EmptyState v-else description="暂无导出模板，请先新建一个" />

    <el-dialog v-model="previewVisible" title="导出预览" width="750px">
      <el-input v-model="previewContent" type="textarea" :rows="22" readonly style="font-family:monospace;font-size:13px" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getExportTemplates, deleteExportTemplate, generateExport } from '@/api/export'
import { getProjectLanguages } from '@/api/language'
import { getTags } from '@/api/translation'
import type { ExportTemplate } from '@/types/models'
import EmptyState from '@/components/common/EmptyState.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const templates = ref<ExportTemplate[]>([])
const projectLanguages = ref<any[]>([])
const selectedTemplate = ref('')
const selectedLangs = ref<string[]>([]); const exportFilterTags = ref<string[]>([])
const allTags = ref<string[]>([])
const previewVisible = ref(false)
const previewContent = ref('')

onMounted(() => loadExports())
watch(projectId, () => { if (projectId.value) loadExports() })
async function loadExports() {
  const [tRes, lRes, tagRes] = await Promise.all([
    getExportTemplates(projectId.value),
    getProjectLanguages(projectId.value),
    getTags(projectId.value).catch(() => ({ data: { data: [] } })),
  ])
  templates.value = tRes.data.data; projectLanguages.value = lRes.data.data; allTags.value = tagRes.data.data
  if (templates.value.length) selectedTemplate.value = templates.value[0].id
  if (projectLanguages.value.length) selectedLangs.value = [projectLanguages.value[0].languageCode]
}

async function doPreview() {
  if (!selectedTemplate.value || !selectedLangs.value.length) {
    ElMessage.warning('请选择模板和语言')
    return
  }
  const { data: res } = await generateExport(projectId.value, selectedTemplate.value, selectedLangs.value, exportFilterTags.value.length ? exportFilterTags.value : undefined)
  previewContent.value = res.data.content
  previewVisible.value = true
}

function doDownload() {
  if (!selectedTemplate.value || !selectedLangs.value.length) {
    ElMessage.warning('请选择模板和语言')
    return
  }
  generateExport(projectId.value, selectedTemplate.value, selectedLangs.value, exportFilterTags.value.length ? exportFilterTags.value : undefined).then(({ data: res }) => {
    const ext = res.data.format === 'csv' ? 'csv' : res.data.format === 'xml' ? 'xml' : 'json'
    const blob = new Blob([res.data.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `translations.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  })
}

async function handleDelete(id: string) {
  await deleteExportTemplate(projectId.value, id)
  templates.value = templates.value.filter(t => t.id !== id)
  if (selectedTemplate.value === id) selectedTemplate.value = templates.value[0]?.id || ''
  ElMessage.success('删除成功')
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.export-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.export-bar .el-form-item { margin-bottom: 0; }
</style>
