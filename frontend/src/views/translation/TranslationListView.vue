<template>
  <div class="trans-page">
    <div class="page-header"><h2>翻译管理</h2></div>
    <el-form :inline="true" :model="filters" class="filter-bar">
      <el-form-item label="全局语言"><el-select v-model="globalLang" placeholder="选择语言" @change="onGlobalLangChange" style="width:160px"><el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.alias || l.languageCode" :value="l.languageCode" /></el-select></el-form-item>
      <el-form-item label="标签筛选"><el-select v-model="filterTags" multiple clearable placeholder="全部标签" style="width:200px" @change="load"><el-option v-for="t in allTags" :key="t" :label="t" :value="t" /></el-select></el-form-item>
      <el-form-item label="搜索"><el-input v-model="filters.search" placeholder="搜索 | #行号 | /正则/" clearable @keyup.enter="doSearch" @clear="doSearch" @blur="doSearch" style="width:260px" /></el-form-item>
      <el-form-item><el-checkbox v-model="untransOnly" @change="load">仅未翻译</el-checkbox></el-form-item>
      <el-form-item><el-button type="primary" @click="doSearch">查询</el-button><el-button v-if="auth.role !== 'member'" @click="openCreate">新增 Key</el-button></el-form-item>
    </el-form>
    <el-table ref="tableRef" :data="rows" stripe v-loading="loading" :key="tableKey" row-key="translationKey" height="100%" v-el-table-infinite-scroll="loadMore">
      <el-table-column v-if="!hasFilter" width="44" fixed="left" class-name="drag-handle-col">
        <template #default><span class="drag-handle">⋮⋮</span></template>
      </el-table-column>
      <el-table-column label="#" width="62" align="center"><template #default="{ row }"><span style="white-space:nowrap">{{ row.rowIndex }}</span></template></el-table-column>
      <el-table-column v-if="auth.role !== 'member'" label="Key" min-width="160">
        <template #default="{ row }"><el-input :model-value="editKey.get(row.translationKey) ?? row.translationKey" @update:model-value="(v: string) => editKey.set(row.translationKey, v)" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @blur="onKeySave(row)" class="inline-input" /></template>
      </el-table-column>
      <el-table-column label="原文" min-width="160">
        <template #default="{ row }"><el-input v-if="auth.role !== 'member'" :model-value="editSource.get(row.translationKey) ?? row.sourceText" @update:model-value="(v: string) => editSource.set(row.translationKey, v)" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" @blur="onSourceSave(row)" class="inline-input" /><span v-else class="pre-wrap">{{ row.sourceText }}</span></template>
      </el-table-column>
      <el-table-column label="语言" width="130">
        <template #default="{ row, $index }"><el-select v-model="rowLangs[$index]" @change="(v: string) => onRowLangChange($index, v)" style="width:100px"><el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.alias || l.languageCode" :value="l.languageCode" /></el-select></template>
      </el-table-column>
      <el-table-column label="译文" min-width="200">
        <template #default="{ row, $index }"><el-input v-model="transCache[row.translationKey + '|' + rowLangs[$index]]" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" @blur="onSave(row, rowLangs[$index])" placeholder="输入译文..." /></template>
      </el-table-column>
      <el-table-column label="标签" width="180">
        <template #default="{ row }"><el-select v-if="auth.role !== 'member'" :model-value="row.tags" @update:model-value="(vals: string[]) => onTagsChange(row, vals)" multiple filterable allow-create size="small" style="width:150px" placeholder="无" /><span v-else style="font-size:13px">{{ row.tags.length ? row.tags.join(', ') : '-' }}</span></template>
      </el-table-column>
      <el-table-column label="备注" min-width="160">
        <template #default="{ row }"><el-input v-if="auth.role !== 'member'" :model-value="row.context" @update:model-value="(v: string) => onCtxSave(row, v)" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" placeholder="备注..." /><span v-else style="font-size:13px" class="pre-wrap">{{ row.context || '-' }}</span></template>
      </el-table-column>
      <el-table-column v-if="auth.role !== 'member'" label="操作" width="80"><template #default="{ row }"><el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button></template></el-table-column>
    </el-table>
    <el-dialog v-model="showCreateDialog" title="新增 Key" width="500px">
      <el-form label-width="60px"><el-form-item label="Key"><el-input v-model="form.translationKey" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="输入翻译 Key" /></el-form-item><el-form-item label="原文"><el-input v-model="form.sourceText" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="输入原文" /></el-form-item><el-form-item label="标签"><el-select v-model="form.tags" multiple filterable allow-create style="width:100%" placeholder="选择或输入标签"><el-option v-for="t in allTags" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-form>
      <template #footer><el-button @click="showCreateDialog = false">取消</el-button><el-button type="primary" @click="handleCreate" :loading="saving">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import Sortable from 'sortablejs'
import elTableInfiniteScroll from 'el-table-infinite-scroll'
const vElTableInfiniteScroll = elTableInfiniteScroll
import client from '@/api/client'
import { useRoute } from 'vue-router'
import { useTranslationStore } from '@/stores/translation'
import { useLanguageStore } from '@/stores/language'
import { getTags, saveTranslation, updateKey, getTranslations } from '@/api/translation'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { GroupedRow } from '@/stores/translation'

const auth = useAuthStore()
const loadingStore = useLoadingStore()
const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const transStore = useTranslationStore()
const langStore = useLanguageStore()
const { rows, total, loading } = storeToRefs(transStore)
const { projectLanguages } = storeToRefs(langStore)

const page = ref(1); const pageSize = ref(20); const filters = reactive({ search: '' }); const loadingMore = ref(false)
const filterTags = ref<string[]>([]); const allTags = ref<string[]>([]); const untransOnly = ref(false)
const globalLang = ref(''); const rowLangs = ref<string[]>([]); const tableKey = ref(0)
const showCreateDialog = ref(false); const saving = ref(false); const form = reactive({ translationKey: '', sourceText: '', tags: [] as string[] })
const transCache = reactive<Record<string, string>>({})
const editKey = ref<Map<string, string>>(new Map())
const editSource = ref<Map<string, string>>(new Map())

function buildCache() { for (const row of rows.value) { for (const [lang, t] of Object.entries(row.translations)) { const ck = row.translationKey + '|' + lang; if (!(ck in transCache)) transCache[ck] = t.translatedText } } }
async function loadTags() { try { const { data: res } = await getTags(projectSlug.value); allTags.value = res.data } catch {} }
onMounted(() => { init() })
watch(projectSlug, () => { if (projectSlug.value) init() })

function doSearch() { if (filters.search !== appliedSearch.value) { appliedSearch.value = filters.search; load() } }
function init() { langStore.fetchProjectLanguages(projectSlug.value); loadTags(); load() }

function onScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return
  const { scrollTop, scrollHeight, clientHeight } = target
  if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore.value && !loadingMore.value) {
    loadMore()
  }
}


let sortable: unknown = null
function bindSortable() {
  const el = document.querySelector('.el-table__body-wrapper tbody') as HTMLElement
  const hasFilter = appliedSearch.value || filterTags.value.length || untransOnly.value
  if (sortable) { (sortable as { destroy: () => void }).destroy(); sortable = null }
  if (!el || auth.role === 'member' || hasFilter) return
  sortable = Sortable.create(el, {
    handle: '.drag-handle',
    animation: 200,
    onEnd({ oldIndex, newIndex }: any) {
      if (oldIndex === newIndex) return
      const clone = [...rows.value]
      const [moved] = clone.splice(oldIndex, 1)
      clone.splice(newIndex, 0, moved)
      rows.value = clone
      rows.value.forEach((r, i) => { r.rowIndex = i + 1 })
      // Update moved row's sortOrder between neighbors' actual sortOrders
      const prev = newIndex > 0 ? rows.value[newIndex - 1] : null
      const nxt = newIndex < rows.value.length - 1 ? rows.value[newIndex + 1] : null
      const prevSo = prev?.sortOrder ?? 0
      const nxtSo = nxt?.sortOrder ?? (prevSo + 200)
      const so = prev ? Math.round((prevSo + nxtSo) / 2) : Math.round(nxtSo / 2)
      client.put('/projects/' + projectSlug.value + '/translations/sortOrders', { orders: [{ keyId: moved.keyId, sortOrder: so }] }).catch(() => {})
    }
  })
}
watch(projectLanguages, (langs) => { if (langs.length && !globalLang.value) { globalLang.value = langs[0].languageCode; load() } })
function syncRowLangs() { rowLangs.value = rows.value.map(() => globalLang.value || projectLanguages.value[0]?.languageCode || '') }

const appliedSearch = ref('')
const hasFilter = computed(() => !!appliedSearch.value || filterTags.value.length > 0 || untransOnly.value)
const hasMore = computed(() => rows.value.length < total.value)

let resetting = false
async function load() {
  page.value = 1; resetting = true; loadingStore.start(); loadingMore.value = true
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
      const allRows: any[] = []
      while (allRows.filter((r: any) => r.rowIndex >= rowStart && r.rowIndex <= rowEnd).length < PZ && allRows.length < (rowEnd - rowStart + PZ)) {
        const { data: r } = await getTranslations(projectSlug.value, { page: pg, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: undefined })
        allRows.push(...r.data.list)
        pg++
      }
      rows.value = allRows.filter((r: any) => r.rowIndex >= rowStart && r.rowIndex <= rowEnd)
      total.value = rowEnd - rowStart + 1
      page.value = pg // remember next page for loadMore
    } else if (isRowSearch && !isNaN(rowStart)) {
      await transStore.fetchTranslations(projectSlug.value, { page: pg, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: undefined })
      rows.value = rows.value.filter((r: any) => r.rowIndex === rowStart)
      total.value = 1
    } else {
      await transStore.fetchTranslations(projectSlug.value, { page: 1, pageSize: PZ, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: appliedSearch.value })
    }
    if (isRowSearch && !isNaN(rowStart)) {
      rows.value = rows.value.filter((r: any) => isRange ? (r.rowIndex >= rowStart && r.rowIndex <= rowEnd) : r.rowIndex === rowStart)
      total.value = isRange ? (rowEnd - rowStart + 1) : 1
    }
    buildCache(); syncRowLangs(); tableKey.value++; await nextTick()
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
        const filtered = r.data.list.filter((row: any) => row.rowIndex >= rowStart && row.rowIndex <= rowEnd)
        if (!filtered.length) break
        rows.value.push(...filtered)
        pg++; page.value = pg
        await nextTick()
      }
    }
    nextTick(() => { bindSortable(); document.querySelector('.el-table__body-wrapper')?.scrollTo(0, 0) })
  } finally { loadingStore.stop(); setTimeout(() => { resetting = false; loadingMore.value = false }, 600) }
}

async function loadMore() {
  const isSingleRow = appliedSearch.value.startsWith('#') && !appliedSearch.value.includes('-')
  if (loading.value || loadingMore.value || resetting || isSingleRow) return
  page.value++; loadingMore.value = true
  try {
    const lang = globalLang.value || projectLanguages.value[0]?.languageCode
    const isRowSearch = appliedSearch.value.startsWith('#')
    const { data: res } = await getTranslations(projectSlug.value, { page: page.value, pageSize: pageSize.value, languageCode: untransOnly.value ? lang : undefined, untransOnly: untransOnly.value, tags: filterTags.value.length ? filterTags.value.join(',') : undefined, search: isRowSearch ? undefined : appliedSearch.value })
    rows.value.push(...res.data.list)
    if (isRowSearch && appliedSearch.value.includes('-')) {
      const s = parseInt(appliedSearch.value.slice(1).split('-')[0]), e = parseInt(appliedSearch.value.split('-')[1]) || 99999
      if (!isNaN(s)) rows.value = rows.value.filter((r: any) => r.rowIndex >= s && r.rowIndex <= e)
    } else {
      total.value = res.data.total
    }
    buildCache(); syncRowLangs(); nextTick(() => bindSortable())
  } finally { loadingMore.value = false }
}

function onGlobalLangChange(lang: string) { rowLangs.value = rows.value.map(() => lang) }
function onRowLangChange(index: number, lang: string) { rowLangs.value[index] = lang }

async function onSave(row: GroupedRow, langCode: string) {
  const ck = row.translationKey + '|' + langCode; const text = transCache[ck] ?? ''; const prev = row.translations[langCode]?.translatedText ?? ''
  if (text === prev) return
  try { await saveTranslation(projectSlug.value, row.translationKey, langCode, { translatedText: text }); if (row.translations[langCode]) row.translations[langCode].translatedText = text; else row.translations[langCode] = { id: '', translatedText: text }; console.log('[翻译]', { key: row.translationKey, lang: langCode, prev: prev || '(空)', new: text }); ElMessage.success(langCode + ': 译文已保存') } catch { ElMessage.error('保存失败') }
}

async function onCtxSave(row: GroupedRow, text: string) { const prev = row.context; if (text === prev) return; try { await saveTranslation(projectSlug.value, row.translationKey, '', { context: text }); row.context = text; console.log('[备注]', { key: row.translationKey, prev, new: text }); ElMessage.success('备注已保存') } catch { ElMessage.error('保存失败') } }

async function onKeySave(row: GroupedRow) {
  const oldKey = row.translationKey; const ek = editKey.value; const newKey = ek.get(oldKey)
  if (newKey === undefined || newKey === oldKey) return
  if (!newKey.trim()) { ElMessage.warning('Key 不能为空'); ek.delete(oldKey); return }
  try { await updateKey(projectSlug.value, oldKey, newKey.trim(), editSource.value.get(oldKey) ?? row.sourceText); ek.delete(oldKey); editSource.value.delete(oldKey); for (const lang of Object.keys(row.translations)) { const oc = oldKey + '|' + lang; const nc = newKey + '|' + lang; if (oc in transCache) { transCache[nc] = transCache[oc]; delete transCache[oc] } }; row.translationKey = newKey.trim(); ElMessage.success('Key 已更新') } catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Key 更新失败'); ek.delete(oldKey) }
}

async function onSourceSave(row: GroupedRow) { const oldKey = row.translationKey; const es = editSource.value; const newSrc = es.get(oldKey); if (newSrc === undefined || newSrc === row.sourceText) return; try { await updateKey(projectSlug.value, oldKey, oldKey, newSrc); es.delete(oldKey); row.sourceText = newSrc; ElMessage.success('原文已更新') } catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '原文更新失败'); es.delete(oldKey) } }

async function onTagsChange(row: GroupedRow, tags: string[]) { try { await saveTranslation(projectSlug.value, row.translationKey, '', { tags }); row.tags = tags; loadTags() } catch { ElMessage.error('保存失败') } }
function openCreate() { Object.assign(form, { translationKey: '', sourceText: '', tags: [] }); showCreateDialog.value = true }

async function handleCreate() {
  if (!form.translationKey.trim() || !form.sourceText.trim()) { ElMessage.warning('Key 和原文为必填'); return }
  saving.value = true
  try { await transStore.create(projectSlug.value, { translationKey: form.translationKey.trim(), languageCode: globalLang.value, sourceText: form.sourceText.trim(), translatedText: '', tags: form.tags }); ElMessage.success('创建成功'); showCreateDialog.value = false; loadTags(); load() } catch { ElMessage.error('创建失败') }
  finally { saving.value = false }
}

async function handleDelete(row: GroupedRow) {
  try { await ElMessageBox.confirm('确定要删除 Key ' + row.translationKey + ' 的所有翻译吗？', '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }) } catch { return }
  try { await transStore.remove(projectSlug.value, row.keyId); ElMessage.success('删除成功'); loadTags(); load() } catch { ElMessage.error('删除失败') }
}
</script>

<style scoped>
.trans-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.trans-page .el-table { flex: 1; }
.page-header { margin-bottom: 16px; } .page-header h2 { margin: 0; }
.filter-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.filter-bar .el-form-item { margin-bottom: 0; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.inline-input { } .inline-input :deep(.el-textarea__inner) { padding: 2px 6px; font-size: 13px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
.drag-handle { color: #c0c4cc; cursor: grab; font-size: 18px; display: block; text-align: center; line-height: 1; padding: 8px 0; }
.drag-handle:hover { color: #409eff; }
.drag-handle-col { user-select: none; }
</style>
