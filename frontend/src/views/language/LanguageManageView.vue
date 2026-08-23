<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { ProjectLanguage } from '@/types/models'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { EmptyState } from '@/components/common'
import { BaseButton, BaseDialog, BaseIcon, BaseInput, BaseLink, BaseNotice, BasePageHeader, BaseSelect, BaseTable, BaseTag } from '@/components/ui'
import { useImportStatus } from '@/hooks/useImportStatus'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useLanguageStore } from '@/stores/language'
import { useProjectStore } from '@/stores/project'
import { decPathParam, encPathParam } from '@/utils/path'

const route = useRoute()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const langStore = useLanguageStore()
const projectStore = useProjectStore()
const { projectLanguages, baseLanguages } = storeToRefs(langStore)
const sourceLanguage = computed(() => projectStore.getProject(projectSlug.value)?.sourceLanguage || '')
const showAddDialog = ref(false)
const selectedLang = ref('')
const aliasCache = reactive<Record<string, string>>({})

watch(projectLanguages, (langs) => {
  if (langs) {
    for (const l of langs) {
      if (!(l.id in aliasCache))
        aliasCache[l.id] = l.alias || ''
    }
  }
}, { immediate: true, deep: true })

onMounted(() => loadLangs())
watch(projectSlug, () => {
  if (projectSlug.value)
    loadLangs()
})
const sortedBaseLanguages = computed(() => [...baseLanguages.value].sort((a, b) => a.englishName.localeCompare(b.englishName)))
const perm = useProjectPermission()
/** 导入锁：导入进行中时语言管理也锁定（增删/设源语言/别名/排序均不可操作），避免与导入并发写入冲突 */
const { isLocked: importLocked, bannerTitle: importLockBannerTitle } = useImportStatus(projectSlug)
const tableLoading = ref(false)
function loadLangs() {
  tableLoading.value = true
  Promise.all([langStore.fetchProjectLanguages(projectSlug.value), langStore.fetchBaseLanguages(), projectStore.fetchProjects(true)]).finally(() => {
    tableLoading.value = false
  })
}

async function handleSetSource(code: string) {
  if (importLocked.value)
    return
  try {
    await client.put(`/projects/${encPathParam(projectSlug.value)}/sourceLanguage`, { languageCode: code })
    ElMessage.success('源语言已更新')
    loadLangs()
  }
  catch {
    ElMessage.error('设置失败')
  }
}

async function onAliasSave(row: ProjectLanguage) {
  if (importLocked.value)
    return
  const alias = aliasCache[row.id]?.trim() ?? ''
  if (alias === (row.alias || ''))
    return
  try {
    await client.put(`/projects/${encPathParam(projectSlug.value)}/languages/${encPathParam(row.id)}/alias`, { alias })
    row.alias = alias || ''
    ElMessage.success('已更新')
  }
  catch { ElMessage.error('更新失败') }
}

async function handleAdd() {
  if (importLocked.value)
    return
  try {
    await langStore.addLanguage(projectSlug.value, selectedLang.value)
    ElMessage.success('添加成功')
    showAddDialog.value = false
    selectedLang.value = ''
  }
  catch { ElMessage.error('添加失败') }
}

async function handleRemove(code: string) {
  if (importLocked.value)
    return
  try {
    await ElMessageBox.confirm('确定要移除此语言吗？关联的翻译数据将被一并删除。', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  try {
    await langStore.removeLanguage(projectSlug.value, code)
    ElMessage.success('删除成功')
  }
  catch { ElMessage.error('删除失败') }
}

async function moveUp(index: number) {
  if (importLocked.value)
    return
  const list = projectLanguages.value || []
  if (index <= 0 || !list.length)
    return
  const cur = list[index]
  list.splice(index, 1)
  list.splice(index - 1, 0, cur)
  await persistOrder(list)
}

async function moveDown(index: number) {
  if (importLocked.value)
    return
  const list = projectLanguages.value || []
  if (index >= list.length - 1)
    return
  const cur = list[index]
  list.splice(index, 1)
  list.splice(index + 1, 0, cur)
  await persistOrder(list)
}

/** 按当前显示顺序全量重编号（index×10）并仅保存变化的行：历史数据 sortOrder 可能并列（新增语言曾默认 0），
 * 只交换相邻两值会制造新并列，刷新后被 orderBy 的 languageCode 兜底打乱顺序 */
async function persistOrder(list: ProjectLanguage[]) {
  const updates = list
    .map((row, index) => ({ row, sortOrder: index * 10 }))
    .filter(({ row, sortOrder }) => row.sortOrder !== sortOrder)
  await Promise.all(updates.map(async ({ row, sortOrder }) => {
    row.sortOrder = sortOrder
    await client.put(`/projects/${encPathParam(projectSlug.value)}/languages/${encPathParam(row.id)}/sortOrder`, { sortOrder }).catch(() => {})
  }))
}

const langColumns: BaseTableColumnConfig<ProjectLanguage>[] = [
  {
    title: '排序',
    width: 80,
    align: 'center',
    cell: (_row, _val, index) => (
      <div>
        {perm.canManageContent.value && !importLocked.value
          ? <BaseLink size="small" underline={false} disabled={index === 0} onClick={() => moveUp(index)}><BaseIcon><ArrowUp /></BaseIcon></BaseLink>
          : null}
        {perm.canManageContent.value && !importLocked.value
          ? <BaseLink size="small" underline={false} disabled={index === (projectLanguages.value || []).length - 1} onClick={() => moveDown(index)}><BaseIcon><ArrowDown /></BaseIcon></BaseLink>
          : null}
      </div>
    ),
  },
  {
    title: '语言代码',
    minWidth: 140,
    cell: row => (
      <div class="lang-name-cell">
        <span>{row.languageCode}</span>
        {row.languageCode === sourceLanguage.value ? <BaseTag size="small" type="primary" class="source-tag">源语言</BaseTag> : null}
      </div>
    ),
  },
  {
    title: '代码别名',
    minWidth: 160,
    cell: row => (
      <BaseInput
        v-model={aliasCache[row.id]}
        size="small"
        placeholder="输入代码别名..."
        readonly={!perm.canManageContent.value || importLocked.value}
        onBlur={() => onAliasSave(row)}
      />
    ),
  },
  {
    title: '代码标识',
    minWidth: 120,
    cell: row => row.alias || row.languageCode,
  },
  {
    title: '语言名称',
    minWidth: 200,
    cell: row => langStore.getBaseName(row.languageCode),
  },
  {
    title: '操作',
    minWidth: 150,
    cell: row => perm.canManageContent.value && !importLocked.value
      ? (
          <div class="op-cell">
            {row.languageCode !== sourceLanguage.value
              ? <BaseLink type="primary" size="small" underline={false} onClick={() => handleSetSource(row.languageCode)}>设为源语言</BaseLink>
              : null}
            <BaseLink type="danger" size="small" underline={false} disabled={row.languageCode === sourceLanguage.value} onClick={() => handleRemove(row.languageCode)}>删除</BaseLink>
          </div>
        )
      : null,
  },
]
</script>

<template>
  <div>
    <BasePageHeader title="语言管理">
      <template #extra>
        <BaseButton v-if="perm.canManageContent.value && !importLocked" type="primary" @click="showAddDialog = true">
          添加语言
        </BaseButton>
      </template>
    </BasePageHeader>
    <BaseNotice
      v-if="importLocked"
      type="warning"
      :closable="false"
      :title="importLockBannerTitle"
    />
    <BaseTable v-loading="tableLoading" :data="projectLanguages || []" :columns="langColumns" stripe row-key="id" />
    <EmptyState v-if="!projectLanguages || !projectLanguages.length" description="暂无语言" />

    <BaseDialog v-model="showAddDialog" title="添加语言" width="500px">
      <BaseSelect v-model="selectedLang" filterable placeholder="搜索语言..." style="width:100%">
        <el-option v-for="l in sortedBaseLanguages" :key="l.languageCode" class="base-option" :label="`${l.englishName} (${l.nativeName || ''}) - ${l.languageCode}`" :value="l.languageCode">
          <span class="lang-option">
            <span class="lang-option__name">{{ l.englishName }} ({{ l.nativeName || '' }})</span>
            <span class="lang-option__code">{{ l.languageCode }}</span>
          </span>
        </el-option>
      </BaseSelect>
      <template #footer>
        <BaseButton @click="showAddDialog = false">
          取消
        </BaseButton><BaseButton type="primary" :disabled="!selectedLang" @click="handleAdd">
          确认添加
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style lang="scss" scoped>
.lang-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.lang-option__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lang-option__code { flex: none; color: #909399; font-size: 12px; }
:deep(.lang-name-cell) { display: inline-flex; align-items: center; gap: 12px; }
:deep(.op-cell) { display: inline-flex; align-items: center; gap: 8px; }
</style>
