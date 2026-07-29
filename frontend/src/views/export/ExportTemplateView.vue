<script setup lang="ts">
import type { ExportTemplate, ProjectLanguage } from '@/types/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { deleteExportTemplate, generateExport, getExportTemplates } from '@/api/export'
import { getProjectLanguages } from '@/api/language'
import { getTags } from '@/api/translation'
import EmptyState from '@/components/common/EmptyState.vue'
import { getFormatMeta } from '@/data/exportFormats'
import { useProjectPermission } from '@/hooks/useProjectPermission'

const route = useRoute()
const perm = useProjectPermission()
const projectSlug = computed(() => route.params.projectSlug as string)
const templates = ref<ExportTemplate[]>([])
const projectLanguages = ref<ProjectLanguage[]>([])
const selectedTemplate = ref('')
const selectedLangs = ref<string[]>([])
const exportFilterTags = ref<string[]>([])
const allTags = ref<string[]>([])
const previewVisible = ref(false)
const previewContent = ref('')

onMounted(() => loadExports())
watch(projectSlug, () => {
  if (projectSlug.value)
    loadExports()
})
async function loadExports() {
  const [tRes, lRes, tagRes] = await Promise.all([
    getExportTemplates(projectSlug.value),
    getProjectLanguages(projectSlug.value),
    getTags(projectSlug.value).catch(() => ({ data: { data: [] } })),
  ])
  templates.value = tRes.data.data
  projectLanguages.value = lRes.data.data
  allTags.value = tagRes.data.data
  if (templates.value.length === 1)
    selectedTemplate.value = templates.value[0].id
  if (projectLanguages.value.length === 1)
    selectedLangs.value = [projectLanguages.value[0].languageCode]
}

async function doPreview() {
  if (!selectedTemplate.value || !selectedLangs.value.length) {
    ElMessage.warning('请选择模板和语言')
    return
  }
  const { data: res } = await generateExport(projectSlug.value, selectedTemplate.value, selectedLangs.value, exportFilterTags.value.length ? exportFilterTags.value : undefined)
  if (res.data.encoding === 'base64') {
    ElMessage.warning('二进制格式不支持预览')
    return
  }
  previewContent.value = res.data.content
  previewVisible.value = true
}

function doDownload() {
  if (!selectedTemplate.value || !selectedLangs.value.length) {
    ElMessage.warning('请选择模板和语言')
    return
  }
  generateExport(projectSlug.value, selectedTemplate.value, selectedLangs.value, exportFilterTags.value.length ? exportFilterTags.value : undefined).then(({ data: res }) => {
    const ext = res.data.format
    let blob: Blob
    if (res.data.encoding === 'base64') {
      const binaryStr = atob(res.data.content)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      blob = new Blob([bytes])
    }
    else {
      blob = new Blob([res.data.content], { type: 'text/plain;charset=utf-8' })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `translations.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  })
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定要删除该导出模板吗？', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  await deleteExportTemplate(projectSlug.value, id)
  templates.value = templates.value.filter(t => t.id !== id)
  if (selectedTemplate.value === id)
    selectedTemplate.value = templates.value[0]?.id || ''
  ElMessage.success('删除成功')
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>导出</h2>
      <el-button v-if="perm.canManageExportTemplates.value" type="primary" @click="$router.push(`/projects/${projectSlug}/exports/new/edit`)">
        新建模板
      </el-button>
    </div>

    <template v-if="templates.length">
      <el-form :inline="true" class="export-bar">
        <el-form-item label="选择模板" required>
          <el-select v-model="selectedTemplate" placeholder="选择导出模板" style="width:240px" filterable clearable>
            <el-option v-for="t in templates" :key="t.id" :label="`${t.name}${t.code ? ` [${t.code}]` : ''} — ${t.formatType}`" :value="t.id">
              <template #default>
                <div class="opt-row">
                  <span class="opt-name">{{ t.name }}{{ t.code ? ` [${t.code}]` : '' }}</span>
                  <span class="opt-meta">{{ t.formatType }}</span>
                </div>
              </template>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="导出语言" required>
          <el-select v-model="selectedLangs" multiple placeholder="选择语言" style="width:280px" filterable clearable>
            <el-option v-for="l in projectLanguages" :key="l.languageCode" :label="`${l.alias || l.languageCode}${l.alias ? ` (${l.languageCode})` : ''}`" :value="l.languageCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签过滤">
          <el-select v-model="exportFilterTags" multiple clearable placeholder="搜索标签" style="width:200px" filterable>
            <el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="doPreview">
            预览
          </el-button>
          <el-button type="success" @click="doDownload">
            下载导出
          </el-button>
        </el-form-item>
      </el-form>

      <el-table :data="templates" stripe style="margin-top:16px">
        <el-table-column prop="name" label="模板名称" />
        <el-table-column label="标识" width="140">
          <template #default="{ row }">
            {{ row.code || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="格式" width="180">
          <template #default="{ row }">
            <el-tooltip placement="top">
              <template #content>
                <div>格式：{{ getFormatMeta(row.formatType).format }}</div>
                <div>标签：{{ getFormatMeta(row.formatType).tags.join('、') }}</div>
              </template>
              <span>{{ row.formatType }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button v-if="perm.canManageExportTemplates.value" link type="primary" @click="$router.push(`/projects/${projectSlug}/exports/${row.id}/edit`)">
              编辑
            </el-button>
            <el-button v-if="perm.canManageExportTemplates.value" link type="danger" @click="handleDelete(row.id)">
              删除
            </el-button>
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

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.export-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.export-bar .el-form-item { margin-bottom: 0; }
.opt-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.opt-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.opt-meta { color: #909399; font-size: 12px; margin-left: 12px; white-space: nowrap; }
</style>
