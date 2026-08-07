<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { ExportTemplate, ProjectLanguage } from '@/types/models'
import { ElMessage, ElMessageBox, ElTooltip } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteExportTemplate, generateExport, getExportTemplates } from '@/api/export'
import { getProjectLanguages } from '@/api/language'
import { getTags } from '@/api/translation'
import EmptyState from '@/components/common/EmptyState.vue'
import { BaseButton, BaseDataViewer, BaseDialog, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect, BaseTable, BaseTabularViewer } from '@/components/ui'
import { ExportFormat, getFormatMeta } from '@/data/exportFormats'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { decPathParam, encPathParam } from '@/utils/path'

const route = useRoute()
const router = useRouter()
const perm = useProjectPermission()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const templates = ref<ExportTemplate[]>([])
const projectLanguages = ref<ProjectLanguage[]>([])
const selectedTemplate = ref('')
const selectedLangs = ref<string[]>([])
const exportFilterTags = ref<string[]>([])
const allTags = ref<string[]>([])
const previewVisible = ref(false)
const previewContent = ref('')
const selectedFormat = computed(() => templates.value.find(t => t.id === selectedTemplate.value)?.formatType)
const dataViewLang = computed<'json' | 'yaml' | 'xml' | null>(() => {
  const fmt = selectedFormat.value
  if (fmt === ExportFormat.FlatYaml || fmt === ExportFormat.NestedYaml)
    return 'yaml'
  if (fmt === ExportFormat.FlatJson || fmt === ExportFormat.NestedJson)
    return 'json'
  if (fmt === ExportFormat.FlatXml || fmt === ExportFormat.NestedXml)
    return 'xml'
  return null
})
const tabularFormat = computed<'csv' | 'properties' | null>(() => {
  if (selectedFormat.value === ExportFormat.Csv)
    return 'csv'
  if (selectedFormat.value === ExportFormat.Properties)
    return 'properties'
  return null
})

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

const exportColumns: BaseTableColumnConfig<ExportTemplate>[] = [
  { dataKey: 'name', title: '模板名称' },
  {
    title: '标识',
    width: 140,
    cell: row => row.code || '-',
  },
  {
    title: '格式',
    width: 180,
    cell: row => <ElTooltip placement="top" content={`格式：${getFormatMeta(row.formatType).format}\n标签：${getFormatMeta(row.formatType).tags.join('、')}`}>{row.formatType}</ElTooltip>,
  },
  { dataKey: 'description', title: '描述' },
  {
    title: '操作',
    width: 150,
    cell: row => (
      <div>
        {perm.canManageExportTemplates.value ? <BaseButton link type="primary" onClick={() => router.push(`/projects/${encPathParam(projectSlug.value)}/exports/${row.id}/edit`)}>编辑</BaseButton> : null}
        {perm.canManageExportTemplates.value ? <BaseButton link type="danger" onClick={() => handleDelete(row.id)}>删除</BaseButton> : null}
      </div>
    ),
  },
]
</script>

<template>
  <div>
    <BasePageHeader title="导出">
      <template #extra>
        <BaseButton v-if="perm.canManageExportTemplates.value" type="primary" @click="$router.push(`/projects/${encPathParam(projectSlug)}/exports/new/edit`)">
          新建模板
        </BaseButton>
      </template>
    </BasePageHeader>

    <template v-if="templates.length">
      <BaseForm :inline="true" class="export-bar">
        <BaseFormItem label="选择模板" required>
          <BaseSelect v-model="selectedTemplate" placeholder="选择导出模板" style="width:240px" filterable clearable>
            <el-option v-for="t in templates" :key="t.id" class="base-option" :label="`${t.name}${t.code ? ` [${t.code}]` : ''} — ${t.formatType}`" :value="t.id">
              <template #default>
                <div class="opt-row">
                  <span class="opt-name">{{ t.name }}{{ t.code ? ` [${t.code}]` : '' }}</span>
                  <span class="opt-meta">{{ t.formatType }}</span>
                </div>
              </template>
            </el-option>
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem label="导出语言" required>
          <BaseSelect v-model="selectedLangs" multiple placeholder="选择语言" style="width:280px" filterable clearable>
            <el-option v-for="l in projectLanguages" :key="l.languageCode" class="base-option" :label="`${l.alias || l.languageCode}${l.alias ? ` (${l.languageCode})` : ''}`" :value="l.languageCode" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem label="标签过滤">
          <BaseSelect v-model="exportFilterTags" multiple clearable placeholder="搜索标签" style="width:200px" filterable>
            <el-option v-for="t in allTags" :key="t" class="base-option" :label="t" :value="t" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem>
          <BaseButton type="primary" @click="doPreview">
            预览
          </BaseButton>
          <BaseButton type="success" @click="doDownload">
            下载导出
          </BaseButton>
        </BaseFormItem>
      </BaseForm>

      <BaseTable :data="templates" :columns="exportColumns" stripe style="margin-top:16px" />
    </template>
    <EmptyState v-else description="暂无导出模板，请先新建一个" />

    <BaseDialog v-model="previewVisible" title="导出预览" width="750px">
      <BaseDataViewer v-if="dataViewLang" :data="previewContent" :lang="dataViewLang" max-height="400px" />
      <BaseTabularViewer v-else-if="tabularFormat" :data="previewContent" :format="tabularFormat" max-height="400px" />
      <BaseInput v-else v-model="previewContent" type="textarea" :rows="22" readonly style="font-family:monospace;font-size:13px" />
    </BaseDialog>
  </div>
</template>

<style lang="scss" scoped>
.export-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.export-bar .el-form-item { margin-bottom: 0; }
.opt-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.opt-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.opt-meta { color: #909399; font-size: 12px; margin-left: 12px; white-space: nowrap; }
</style>
