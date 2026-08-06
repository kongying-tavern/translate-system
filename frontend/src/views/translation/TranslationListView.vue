<script setup lang="tsx">
import type { GroupedRow } from '@/api/translation'
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import elTableInfiniteScroll from 'el-table-infinite-scroll'
import { ElInputTag, ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import Sortable from 'sortablejs'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { getTags, getTranslations, saveTranslation, updateKey } from '@/api/translation'
import { BaseButton, BaseCheckbox, BaseDialog, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect, BaseTable } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useLanguageStore } from '@/stores/language'
import { useLoadingStore } from '@/stores/loading'
import { useTranslationStore } from '@/stores/translation'
import { encSlug } from '@/utils/slug'

const vElTableInfiniteScroll = elTableInfiniteScroll

const perm = useProjectPermission()
const loadingStore = useLoadingStore()
const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const transStore = useTranslationStore()
const langStore = useLanguageStore()
const { rows, total, loading } = storeToRefs(transStore)
const { projectLanguages } = storeToRefs(langStore)

const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ search: '' })
const loadingMore = ref(false)
const filterTags = ref<string[]>([])
const allTags = ref<string[]>([])
const untransOnly = ref(false)
const globalLang = ref('')
const rowLangs = ref<string[]>([])
const tableKey = ref(0)
const showCreateDialog = ref(false)
const saving = ref(false)
const form = reactive({ translationKey: '', sourceText: '', tags: [] as string[] })
const transCache = reactive<Record<string, string>>({})
const editKey = ref<Map<string, string>>(new Map())
const editSource = ref<Map<string, string>>(new Map())
const tagDelimiter = /[,;]/

const appliedSearch = ref('')
const hasFilter = computed(() => !!appliedSearch.value || filterTags.value.length > 0 || untransOnly.value)

function buildCache() {
  for (const row of rows.value) {
    for (const [lang, t] of Object.entries(row.translations)) {
      const ck = `${row.translationKey}|${lang}`
      if (!(ck in transCache))
        transCache[ck] = t.translatedText
    }
  }
}
async function loadTags() {
  try {
    const { data: res } = await getTags(projectSlug.value)
    allTags.value = res.data
  }
  catch {}
}
onMounted(() => {
  init()
})
watch(projectSlug, () => {
  if (projectSlug.value)
    init()
})

function doSearch() {
  appliedSearch.value = filters.search
  load()
}
function init() {
  langStore.fetchProjectLanguages(projectSlug.value)
  loadTags()
  load()
}

let sortable: { destroy: () => void } | null = null
function bindSortable() {
  const el = document.querySelector('.el-table__body-wrapper tbody') as HTMLElement
  const hasFilter = appliedSearch.value || filterTags.value.length || untransOnly.value
  if (sortable) {
    sortable.destroy()
    sortable = null
  }
  if (!el || !perm.canReorderRows.value || hasFilter)
    return
  sortable = Sortable.create(el, {
    handle: '.drag-handle',
    animation: 200,
    onEnd({ oldIndex, newIndex }: { oldIndex: number, newIndex: number }) {
      if (oldIndex === newIndex)
        return
      const clone = [...rows.value]
      const [moved] = clone.splice(oldIndex, 1)
      clone.splice(newIndex, 0, moved)
      rows.value = clone
      rows.value.forEach((r, i) => {
        r.rowIndex = i + 1
      })
      // Update moved row's sortOrder between neighbors' actual sortOrders
      const prev = newIndex > 0 ? rows.value[newIndex - 1] : null
      const nxt = newIndex < rows.value.length - 1 ? rows.value[newIndex + 1] : null
      const prevSo = prev?.sortOrder ?? 0
      const nxtSo = nxt?.sortOrder ?? (prevSo + 200)
      const so = prev ? Math.round((prevSo + nxtSo) / 2) : Math.round(nxtSo / 2)
      client.put(`/projects/${encSlug(projectSlug.value)}/translations/sortOrders`, { orders: [{ keyId: moved.keyId, sortOrder: so }] }).catch(() => {})
    },
  })
}
watch(projectLanguages, (langs) => {
  if (langs.length && !globalLang.value) {
    globalLang.value = langs[0].languageCode
    load()
  }
})
function syncRowLangs() {
  rowLangs.value = rows.value.map(() => globalLang.value || projectLanguages.value[0]?.languageCode || '')
}

let resetting = false
async function load() {
  page.value = 1
  resetting = true
  loadingStore.start()
  loadingMore.value = true
  try {
    const lang = globalLang.value || projectLanguages.value[0]?.languageCode
    const isRowSearch = appliedSearch.value.startsWith('#')
    const rowQuery = isRowSearch ? appliedSearch.value.slice(1) : ''
    const isRange = rowQuery.includes('-')
    const rowStart = isRowSearch ? parseInt(rowQuery.split('-')[0]) : 0
    const rowEnd = isRange ? (parseInt(rowQuery.split('-')[1]) || 99999) : rowStart
    const PZ = pageSize.value
    let pg = isRowSearch && !isNaN(rowStart) ? Math.ceil(rowStart / PZ) : 1
    if (isRowSearch && isRange && !isNaN(rowStart)) {
      // Load enough pages to get at least 20 filtered rows for range search
      const allRows: GroupedRow[] = []
      while (allRows.filter((r: GroupedRow) => r.rowIndex >= rowStart && r.rowIndex <= rowEnd).length < PZ && allRows.length < (rowEnd - rowStart + PZ)) {
        const { data: r } = await getTranslations(projectSlug.value, { page: pg, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: undefined })
        allRows.push(...r.data.list)
        pg++
      }
      rows.value = allRows.filter((r: GroupedRow) => r.rowIndex >= rowStart && r.rowIndex <= rowEnd)
      total.value = rowEnd - rowStart + 1
      page.value = pg // remember next page for loadMore
    }
    else if (isRowSearch && !isNaN(rowStart)) {
      await transStore.fetchTranslations(projectSlug.value, { page: pg, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: undefined })
      rows.value = rows.value.filter((r: GroupedRow) => r.rowIndex === rowStart)
      total.value = 1
    }
    else {
      await transStore.fetchTranslations(projectSlug.value, { page: 1, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: appliedSearch.value })
    }
    if (isRowSearch && !isNaN(rowStart)) {
      rows.value = rows.value.filter((r: GroupedRow) => isRange ? (r.rowIndex >= rowStart && r.rowIndex <= rowEnd) : r.rowIndex === rowStart)
      total.value = isRange ? (rowEnd - rowStart + 1) : 1
    }
    buildCache()
    syncRowLangs()
    tableKey.value++
    await nextTick()
    // Viewport fill for range search: calc visible rows, load enough to overflow
    if (isRowSearch && isRange && !isNaN(rowStart)) {
      const pageEl = document.querySelector('.trans-page') as HTMLElement
      const rowEl = document.querySelector('.el-table__row') as HTMLElement
      const headerEl = document.querySelector('.page-header') as HTMLElement
      const filterEl = document.querySelector('.filter-bar') as HTMLElement
      const pageH = pageEl?.clientHeight || window.innerHeight - 100
      const headerH = headerEl?.offsetHeight || 0
      const filterH = filterEl?.offsetHeight || 0
      const rowH = rowEl?.offsetHeight || 40
      const visible = Math.max(1, Math.ceil((pageH - headerH - filterH - 32) / rowH))
      const needed = visible + 5
      while (rows.value.length < needed && rows.value.length < total.value) {
        const { data: r } = await getTranslations(projectSlug.value, { page: pg, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: undefined })
        const filtered = r.data.list.filter((row: GroupedRow) => row.rowIndex >= rowStart && row.rowIndex <= rowEnd)
        if (!filtered.length)
          break
        rows.value.push(...filtered)
        pg++
        page.value = pg
        await nextTick()
      }
    }
    nextTick(() => {
      bindSortable()
      document.querySelector('.el-table__body-wrapper')?.scrollTo(0, 0)
    })
  }
  finally {
    loadingStore.stop()
    setTimeout(() => {
      resetting = false
      loadingMore.value = false
    }, 600)
  }
}

async function loadMore() {
  const isSingleRow = appliedSearch.value.startsWith('#') && !appliedSearch.value.includes('-')
  if (loading.value || loadingMore.value || resetting || isSingleRow)
    return
  page.value++
  loadingMore.value = true
  try {
    const lang = globalLang.value || projectLanguages.value[0]?.languageCode
    const isRowSearch = appliedSearch.value.startsWith('#')
    const { data: res } = await getTranslations(projectSlug.value, { page: page.value, pageSize: pageSize.value, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: isRowSearch ? undefined : appliedSearch.value })
    rows.value.push(...res.data.list)
    if (isRowSearch && appliedSearch.value.includes('-')) {
      const s = parseInt(appliedSearch.value.slice(1).split('-')[0])
      const e = parseInt(appliedSearch.value.split('-')[1]) || 99999
      if (!isNaN(s))
        rows.value = rows.value.filter((r: GroupedRow) => r.rowIndex >= s && r.rowIndex <= e)
    }
    else {
      total.value = res.data.total
    }
    buildCache()
    syncRowLangs()
    nextTick(() => bindSortable())
  }
  finally {
    loadingMore.value = false
  }
}

function onGlobalLangChange(lang: string) {
  rowLangs.value = rows.value.map(() => lang)
  load()
}
function onRowLangChange(index: number, lang: string) {
  rowLangs.value[index] = lang
}

async function onSave(row: GroupedRow, langCode: string) {
  const ck = `${row.translationKey}|${langCode}`
  const text = transCache[ck] ?? ''
  const prev = row.translations[langCode]?.translatedText ?? ''
  if (text === prev)
    return
  try {
    await saveTranslation(projectSlug.value, row.translationKey, langCode, { translatedText: text })
    if (row.translations[langCode])
      row.translations[langCode].translatedText = text
    else
      row.translations[langCode] = { id: '', translatedText: text }
    // eslint-disable-next-line no-console
    console.log('[翻译]', { key: row.translationKey, lang: langCode, prev: prev || '(空)', new: text })
    ElMessage.success(`${langCode}: 译文已保存`)
  }
  catch {
    ElMessage.error('保存失败')
  }
}

async function onCtxSave(row: GroupedRow, text: string) {
  const prev = row.context
  if (text === prev)
    return
  try {
    await saveTranslation(projectSlug.value, row.translationKey, '', { context: text })
    row.context = text
    // eslint-disable-next-line no-console
    console.log('[备注]', { key: row.translationKey, prev, new: text })
    ElMessage.success('备注已保存')
  }
  catch {
    ElMessage.error('保存失败')
  }
}

async function onKeySave(row: GroupedRow) {
  const oldKey = row.translationKey
  const ek = editKey.value
  const newKey = ek.get(oldKey)
  if (newKey === undefined || newKey === oldKey)
    return
  if (!newKey.trim()) {
    ElMessage.warning('Key 不能为空')
    ek.delete(oldKey)
    return
  }
  try {
    await updateKey(projectSlug.value, oldKey, newKey.trim(), editSource.value.get(oldKey) ?? row.sourceText)
    ek.delete(oldKey)
    editSource.value.delete(oldKey)
    for (const lang of Object.keys(row.translations)) {
      const oc = `${oldKey}|${lang}`
      const nc = `${newKey}|${lang}`
      if (oc in transCache) {
        transCache[nc] = transCache[oc]
        delete transCache[oc]
      }
    }
    row.translationKey = newKey.trim()
    ElMessage.success('Key 已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Key 更新失败')
    ek.delete(oldKey)
  }
}

async function onSourceSave(row: GroupedRow) {
  const oldKey = row.translationKey
  const es = editSource.value
  const newSrc = es.get(oldKey)
  if (newSrc === undefined || newSrc === row.sourceText)
    return
  try {
    await updateKey(projectSlug.value, oldKey, oldKey, newSrc)
    es.delete(oldKey)
    row.sourceText = newSrc
    ElMessage.success('原文已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '原文更新失败')
    es.delete(oldKey)
  }
}

async function onTagsChange(row: GroupedRow) {
  try {
    await saveTranslation(projectSlug.value, row.translationKey, '', { tags: row.tags })
    loadTags()
  }
  catch {
    ElMessage.error('保存失败')
    load()
  }
}
function openCreate() {
  Object.assign(form, { translationKey: '', sourceText: '', tags: [] })
  showCreateDialog.value = true
}

async function handleCreate() {
  if (!form.translationKey.trim() || !form.sourceText.trim()) {
    ElMessage.warning('Key 和原文为必填')
    return
  }
  saving.value = true
  try {
    await transStore.create(projectSlug.value, { translationKey: form.translationKey.trim(), languageCode: globalLang.value, sourceText: form.sourceText.trim(), translatedText: '', tags: form.tags })
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadTags()
    load()
  }
  catch {
    ElMessage.error('创建失败')
  }
  finally {
    saving.value = false
  }
}

async function handleDelete(row: GroupedRow) {
  try {
    await ElMessageBox.confirm(`确定要删除 Key ${row.translationKey} 的所有翻译吗？`, '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
  }
  catch {
    return
  }
  try {
    await transStore.remove(projectSlug.value, row.keyId)
    ElMessage.success('删除成功')
    loadTags()
    load()
  }
  catch {
    ElMessage.error('删除失败')
  }
}

const translationColumns = computed<BaseTableColumnConfig<GroupedRow>[]>(() => {
  const cols: BaseTableColumnConfig<GroupedRow>[] = []

  if (!hasFilter.value && perm.canReorderRows.value) {
    cols.push({
      width: 44,
      fixed: 'left',
      cell: () => <span class="drag-handle">⋮⋮</span>,
    })
  }

  cols.push({
    title: '#',
    width: 62,
    align: 'center',
    cell: row => <span style={{ whiteSpace: 'nowrap' }}>{String(row.rowIndex)}</span>,
  })

  cols.push({
    title: 'Key',
    minWidth: 160,
    cell: (row) => {
      if (perm.canEditKeyColumn.value) {
        return <BaseInput modelValue={editKey.value.get(row.translationKey) ?? row.translationKey} onUpdate:modelValue={(v: string) => editKey.value.set(row.translationKey, v)} onBlur={() => onKeySave(row)} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" class="inline-input" />
      }
      return <span class="pre-wrap">{row.translationKey}</span>
    },
  })

  cols.push({
    title: '原文',
    minWidth: 160,
    cell: (row) => {
      if (perm.canEditSourceColumn.value) {
        return <BaseInput modelValue={editSource.value.get(row.translationKey) ?? row.sourceText} onUpdate:modelValue={(v: string) => editSource.value.set(row.translationKey, v)} onBlur={() => onSourceSave(row)} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" class="inline-input" />
      }
      return <span class="pre-wrap">{row.sourceText}</span>
    },
  })

  cols.push({
    title: '语言',
    width: 130,
    cell: (_row, _val, index) => <BaseSelect modelValue={rowLangs.value[index]} style={{ width: '100px' }} onChange={(v: unknown) => onRowLangChange(index, v as string)}>{(projectLanguages.value || []).map(l => <el-option label={l.alias || l.languageCode} value={l.languageCode} />)}</BaseSelect>,
  })

  cols.push({
    title: '译文',
    minWidth: 200,
    cell: (row, _val, index) => <BaseInput modelValue={transCache[`${row.translationKey}|${rowLangs.value[index]}`]} onUpdate:modelValue={(v: string) => transCache[`${row.translationKey}|${rowLangs.value[index]}`] = v} onBlur={() => onSave(row, rowLangs.value[index])} type="textarea" autosize={{ minRows: 1, maxRows: 6 }} size="small" placeholder="输入译文..." />,
  })

  cols.push({
    title: '标签',
    width: 260,
    cell: (row) => {
      if (perm.canEditTagsColumn.value) {
        return (
          <ElInputTag
            size="small"
            placeholder="+标签"
            clearable
            modelValue={row.tags}
            onUpdate:modelValue={(v?: string[]) => { row.tags = v ?? row.tags }}
            onChange={() => onTagsChange(row)}
            delimiter={tagDelimiter}
          />
        )
      }
      return <span style={{ fontSize: '13px' }}>{row.tags.length ? row.tags.join(', ') : '-'}</span>
    },
  })

  cols.push({
    title: '备注',
    minWidth: 160,
    cell: (row) => {
      if (perm.canEditContextColumn.value) {
        return <BaseInput modelValue={row.context} onUpdate:modelValue={(v: string) => onCtxSave(row, v)} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" placeholder="备注..." />
      }
      return <span style={{ fontSize: '13px' }} class="pre-wrap">{row.context || '-'}</span>
    },
  })

  cols.push({
    title: '操作',
    width: 80,
    cell: row => perm.canManageKeys.value ? <BaseButton link type="danger" size="small" onClick={() => handleDelete(row)}>删除</BaseButton> : null,
  })

  return cols
})
</script>

<template>
  <div class="trans-page">
    <BasePageHeader title="翻译管理" />
    <BaseForm :inline="true" :model="filters" class="filter-bar">
      <BaseFormItem label="全局语言">
        <BaseSelect v-model="globalLang" placeholder="选择语言" style="width:160px" @change="onGlobalLangChange">
          <el-option v-for="l in projectLanguages" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="标签筛选">
        <BaseSelect v-model="filterTags" multiple filterable clearable placeholder="全部标签" style="width:200px">
          <el-option v-for="t in allTags" :key="t" class="base-option" :label="t" :value="t" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="搜索">
        <BaseInput v-model="filters.search" placeholder="搜索 | #行号 | /正则/" clearable style="width:260px" />
      </BaseFormItem>
      <BaseFormItem>
        <BaseCheckbox v-model="untransOnly" @change="load">
          仅未翻译
        </BaseCheckbox>
      </BaseFormItem>
      <BaseFormItem>
        <BaseButton type="primary" @click="doSearch">
          查询
        </BaseButton><BaseButton v-if="perm.canManageKeys.value" @click="openCreate">
          新增 Key
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
    <BaseTable :key="tableKey" v-loading="loading" v-el-table-infinite-scroll="loadMore" :data="rows" :columns="translationColumns" stripe row-key="translationKey" height="100%" class="trans-table" />
    <BaseDialog v-model="showCreateDialog" title="新增 Key" width="500px">
      <BaseForm label-width="60px" class="dialog-form">
        <BaseFormItem label="Key">
          <BaseInput v-model="form.translationKey" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="输入翻译 Key" />
        </BaseFormItem><BaseFormItem label="原文">
          <BaseInput v-model="form.sourceText" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="输入原文" />
        </BaseFormItem><BaseFormItem label="标签">
          <ElInputTag v-model="form.tags" style="width:100%" placeholder="输入标签，回车添加" clearable :delimiter="tagDelimiter" />
        </BaseFormItem>
      </BaseForm>
      <template #footer>
        <BaseButton @click="showCreateDialog = false">
          取消
        </BaseButton><BaseButton type="primary" :loading="saving" @click="handleCreate">
          保存
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style lang="scss" scoped>
.trans-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.trans-page .el-table { flex: 1; }
.filter-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.filter-bar .el-form-item { margin-bottom: 0; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.inline-input { } .inline-input :deep(.el-textarea__inner) { padding: 2px 6px; font-size: 13px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
.trans-table :deep(.el-table__body .el-table__cell) { vertical-align: top; }
.trans-table :deep(.drag-handle) { color: #c0c4cc; cursor: pointer; user-select: none; font-size: 18px; display: block; text-align: center; line-height: 1; padding: 8px 0; }
.trans-table :deep(.drag-handle:hover) { color: #409eff; }
</style>
