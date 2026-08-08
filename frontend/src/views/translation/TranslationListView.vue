<script setup lang="tsx">
import type { GroupedRow } from '@/api/translation'
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import { Loading } from '@element-plus/icons-vue'
import elTableInfiniteScroll from 'el-table-infinite-scroll'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import Sortable from 'sortablejs'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { getTags, getTranslations, saveTranslation, updateKey } from '@/api/translation'
import { BaseButton, BaseCheckbox, BaseDialog, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect, BaseTable, BaseTagInput } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useLanguageStore } from '@/stores/language'
import { useLoadingStore } from '@/stores/loading'
import { useProjectStore } from '@/stores/project'
import { useTranslationStore } from '@/stores/translation'
import { decPathParam, encPathParam } from '@/utils/path'

const vElTableInfiniteScroll = elTableInfiniteScroll

const perm = useProjectPermission()
const loadingStore = useLoadingStore()
const route = useRoute()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const transStore = useTranslationStore()
const langStore = useLanguageStore()
const projectStore = useProjectStore()
const { rows, total, loading } = storeToRefs(transStore)
const { projectLanguages } = storeToRefs(langStore)
const sourceLanguage = computed(() => projectStore.getProject(projectSlug.value)?.sourceLanguage || '')
const editableLangs = computed(() => (projectLanguages.value || []).filter(l => l.languageCode !== sourceLanguage.value))

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
const form = reactive({ translationKey: '', tags: [] as string[] })
const transCache = reactive<Record<string, string>>({})
const editKey = ref<Map<string, string>>(new Map())
const editSource = ref<Map<string, string>>(new Map())
const editContext = ref<Map<string, string>>(new Map())
const composing = ref(false)

const appliedSearch = ref('')
const hasFilter = computed(() => !!appliedSearch.value || filterTags.value.length > 0 || untransOnly.value)
const dragOrderable = ref(true)

function buildCache() {
  for (const row of rows.value) {
    for (const [lang, t] of Object.entries(row.translations)) {
      const ck = `${row.keyId}|${lang}`
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
  projectStore.fetchProjects()
  loadTags()
  load()
}

let sortable: { destroy: () => void } | null = null
function bindSortable() {
  const el = document.querySelector('.el-table__body-wrapper tbody') as HTMLElement
  if (sortable) {
    sortable.destroy()
    sortable = null
  }
  if (!el || !perm.canReorderRows.value || !dragOrderable.value)
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
      // 折半插入 moved 行到相邻行 sortOrder 之间；相邻值相同/重叠（间距耗尽）时无空位，
      // 折半结果与邻居相等导致排序不生效，此时从相邻最小值开始整页重排以保留相对位置
      const prev = newIndex > 0 ? rows.value[newIndex - 1] : null
      const nxt = newIndex < rows.value.length - 1 ? rows.value[newIndex + 1] : null
      const prevSo = prev?.sortOrder ?? 0
      const nxtSo = nxt?.sortOrder ?? (prevSo + 1000)
      const so = prev ? Math.round((prevSo + nxtSo) / 2) : Math.round(nxtSo / 2)
      const base = prev ? prevSo : nxtSo
      const orders = (so <= prevSo || (nxt && so >= nxtSo))
        ? rows.value.map((r, i) => ({ keyId: r.keyId, sortOrder: base + (i + 1) * 10 }))
        : [{ keyId: moved.keyId, sortOrder: so }]
      client.put(`/projects/${encPathParam(projectSlug.value)}/translations/sortOrders`, { orders }).catch(() => {})
    },
  })
}
watch(editableLangs, (langs) => {
  if (langs.length && (!globalLang.value || !langs.some(l => l.languageCode === globalLang.value))) {
    globalLang.value = langs[0].languageCode
    load()
  }
})
function syncRowLangs() {
  rowLangs.value = rows.value.map(() => globalLang.value || editableLangs.value[0]?.languageCode || '')
}

let resetting = false
async function load() {
  dragOrderable.value = !hasFilter.value
  page.value = 1
  resetting = true
  loadingStore.start()
  loadingMore.value = true
  try {
    const lang = globalLang.value || editableLangs.value[0]?.languageCode
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
  // 已全部加载则不再请求（行号范围搜索的 rows 是过滤结果，跳过此判断）
  const isRangeSearch = appliedSearch.value.startsWith('#') && appliedSearch.value.includes('-')
  if (!isRangeSearch && rows.value.length >= total.value)
    return
  page.value++
  loadingMore.value = true
  try {
    const lang = globalLang.value || editableLangs.value[0]?.languageCode
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
  // 仅未翻译按当前语言判断，切换语言需刷新列表；普通显示切换不刷新
  if (untransOnly.value)
    load()
}
function onRowLangChange(index: number, lang: string) {
  rowLangs.value[index] = lang
}

async function onSave(row: GroupedRow, langCode: string) {
  const ck = `${row.keyId}|${langCode}`
  const text = transCache[ck] ?? ''
  const prev = row.translations[langCode]?.translatedText ?? ''
  if (text === prev)
    return
  try {
    await saveTranslation(projectSlug.value, row.keyId, langCode, text)
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

async function onCtxSave(row: GroupedRow) {
  const ec = editContext.value
  const text = ec.get(row.keyId) ?? row.context
  if (text === row.context) {
    ec.delete(row.keyId)
    return
  }
  try {
    await updateKey(projectSlug.value, row.keyId, { context: text })
    row.context = text
    ec.delete(row.keyId)
    // eslint-disable-next-line no-console
    console.log('[备注]', { key: row.translationKey, prev: row.context, new: text })
    ElMessage.success('备注已更新')
  }
  catch {
    ElMessage.error('保存失败')
  }
}

async function onKeySave(row: GroupedRow) {
  const ek = editKey.value
  const newKey = ek.get(row.keyId)
  if (newKey === undefined || newKey === row.translationKey)
    return
  if (!newKey.trim()) {
    ElMessage.warning('Key 不能为空')
    ek.delete(row.keyId)
    return
  }
  try {
    await updateKey(projectSlug.value, row.keyId, { translationKey: newKey.trim(), sourceText: editSource.value.get(row.keyId) ?? row.sourceText })
    ek.delete(row.keyId)
    editSource.value.delete(row.keyId)
    row.translationKey = newKey.trim()
    ElMessage.success('Key 已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Key 更新失败')
    ek.delete(row.keyId)
  }
}

async function onSourceSave(row: GroupedRow) {
  const es = editSource.value
  const newSrc = es.get(row.keyId)
  if (newSrc === undefined || newSrc === row.sourceText)
    return
  try {
    await updateKey(projectSlug.value, row.keyId, { sourceText: newSrc })
    es.delete(row.keyId)
    row.sourceText = newSrc
    ElMessage.success('原文已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '原文更新失败')
    es.delete(row.keyId)
  }
}

async function onTagsChange(row: GroupedRow) {
  try {
    await updateKey(projectSlug.value, row.keyId, { tags: row.tags })
    ElMessage.success('标签已更新')
    loadTags()
  }
  catch {
    ElMessage.error('保存失败')
    load()
  }
}
function openCreate() {
  Object.assign(form, { translationKey: '', tags: [] })
  showCreateDialog.value = true
}

async function handleCreate() {
  if (!form.translationKey.trim()) {
    ElMessage.warning('请填写 Key')
    return
  }
  if (!globalLang.value) {
    ElMessage.warning('请先在语言管理中添加目标语言')
    return
  }
  saving.value = true
  try {
    await transStore.create(projectSlug.value, { translationKey: form.translationKey.trim(), languageCode: globalLang.value, translatedText: '', tags: form.tags })
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

function onCompositionStart() {
  composing.value = true
}
function onCompositionEnd() {
  composing.value = false
}
function handleBlurSave(action: () => void) {
  const wasComposing = composing.value
  composing.value = false
  if (!wasComposing)
    action()
}

const translationColumns = computed<BaseTableColumnConfig<GroupedRow>[]>(() => {
  const cols: BaseTableColumnConfig<GroupedRow>[] = []

  if (dragOrderable.value && perm.canReorderRows.value) {
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
        return <BaseInput modelValue={editKey.value.get(row.keyId) ?? row.translationKey} onUpdate:modelValue={(v: string) => editKey.value.set(row.keyId, v)} onCompositionstart={onCompositionStart} onCompositionend={onCompositionEnd} onBlur={() => handleBlurSave(() => onKeySave(row))} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" class="inline-input" />
      }
      return <span class="pre-wrap">{row.translationKey}</span>
    },
  })

  cols.push({
    title: '原文',
    minWidth: 160,
    cell: (row) => {
      if (perm.canEditSourceColumn.value) {
        return <BaseInput modelValue={editSource.value.get(row.keyId) ?? row.sourceText} onUpdate:modelValue={(v: string) => editSource.value.set(row.keyId, v)} onCompositionstart={onCompositionStart} onCompositionend={onCompositionEnd} onBlur={() => handleBlurSave(() => onSourceSave(row))} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" class="inline-input" />
      }
      return <span class="pre-wrap">{row.sourceText}</span>
    },
  })

  cols.push({
    title: '语言',
    width: 130,
    cell: (_row, _val, index) => <BaseSelect modelValue={rowLangs.value[index]} style={{ width: '100px' }} onChange={(v: unknown) => onRowLangChange(index, v as string)}>{(editableLangs.value || []).map(l => <el-option label={l.alias || l.languageCode} value={l.languageCode} />)}</BaseSelect>,
  })

  cols.push({
    title: '译文',
    minWidth: 200,
    cell: (row, _val, index) => <BaseInput modelValue={transCache[`${row.keyId}|${rowLangs.value[index]}`]} onUpdate:modelValue={(v: string) => transCache[`${row.keyId}|${rowLangs.value[index]}`] = v} onBlur={() => onSave(row, rowLangs.value[index])} type="textarea" autosize={{ minRows: 1, maxRows: 6 }} size="small" placeholder="输入译文..." />,
  })

  cols.push({
    title: '标签',
    width: 260,
    cell: (row) => {
      if (perm.canEditTagsColumn.value) {
        return (
          <BaseTagInput
            size="small"
            options={allTags.value}
            modelValue={row.tags}
            onUpdate:modelValue={(v?: string[]) => { row.tags = v ?? row.tags }}
            onChange={() => onTagsChange(row)}
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
        return <BaseInput modelValue={editContext.value.get(row.keyId) ?? row.context} onUpdate:modelValue={(v: string) => editContext.value.set(row.keyId, v)} onCompositionstart={onCompositionStart} onCompositionend={onCompositionEnd} onBlur={() => handleBlurSave(() => onCtxSave(row))} type="textarea" autosize={{ minRows: 1, maxRows: 4 }} size="small" placeholder="备注..." />
      }
      return <span style={{ fontSize: '13px' }} class="pre-wrap">{row.context || '-'}</span>
    },
  })

  if (perm.canManageKeys.value) {
    cols.push({
      title: '操作',
      width: 80,
      cell: row => <BaseButton link type="danger" size="small" onClick={() => handleDelete(row)}>删除</BaseButton>,
    })
  }

  return cols
})
</script>

<template>
  <div class="trans-page">
    <BasePageHeader title="翻译管理">
      <template #extra>
        <span class="total-count">共 {{ total }} 条</span>
      </template>
    </BasePageHeader>
    <BaseForm :inline="true" :model="filters" class="filter-bar">
      <BaseFormItem label="源语言">
        <el-tag v-if="sourceLanguage" size="small" type="primary" effect="plain">
          {{ sourceLanguage }}
        </el-tag>
      </BaseFormItem>
      <BaseFormItem label="全局语言">
        <BaseSelect v-model="globalLang" placeholder="选择语言" style="width:160px" @change="onGlobalLangChange">
          <el-option v-for="l in editableLangs" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="标签筛选">
        <BaseSelect v-model="filterTags" multiple filterable clearable :reserve-keyword="false" placeholder="全部标签" style="width:200px">
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
    <BaseTable :key="tableKey" v-loading="loading" v-el-table-infinite-scroll="loadMore" :data="rows" :columns="translationColumns" stripe row-key="translationKey" height="100%" class="trans-table">
      <template #append>
        <div v-if="loadingMore" class="load-more-tip">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          正在加载更多...
        </div>
        <div v-else-if="!loading && rows.length >= total" class="load-more-tip">
          已全部加载
        </div>
      </template>
    </BaseTable>
    <BaseDialog v-model="showCreateDialog" title="新增 Key" width="500px">
      <BaseForm label-width="60px" class="dialog-form">
        <BaseFormItem label="Key">
          <BaseInput v-model="form.translationKey" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="输入翻译 Key" />
        </BaseFormItem><BaseFormItem label="标签">
          <BaseTagInput v-model="form.tags" :options="allTags" style="width:100%" />
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
.total-count { color: #909399; font-size: 14px; font-weight: normal; }
.filter-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.filter-bar .el-form-item { margin-bottom: 0; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.inline-input { } .inline-input :deep(.el-textarea__inner) { padding: 2px 6px; font-size: 13px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
.trans-table :deep(.el-table__body .el-table__cell) { vertical-align: top; }
.trans-table :deep(.drag-handle) { color: #c0c4cc; cursor: pointer; user-select: none; font-size: 18px; display: block; text-align: center; line-height: 1; padding: 8px 0; }
.trans-table :deep(.drag-handle:hover) { color: #409eff; }
.load-more-tip { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 0; color: #606266; font-size: 14px; background: #f5f7fa; border-top: 1px solid #e4e7ed; }
</style>
