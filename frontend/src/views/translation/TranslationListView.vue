<script setup lang="tsx">
import type { Column, RowClassNameGetter } from 'element-plus'
import type { VNode } from 'vue'
import type { GroupedRow } from '@/api/translation'
import { Edit, RefreshRight } from '@element-plus/icons-vue'
import { ElAutoResizer, ElMessage, ElMessageBox, ElOption, TableV2FixedDir } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { getTags, saveTranslation, updateKey } from '@/api/translation'
import { BaseButton, BaseCheckbox, BaseDialog, BaseForm, BaseFormItem, BaseIcon, BaseInput, BasePageHeader, BaseSelect, BaseTableVirtualized, BaseTagInput } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useLanguageStore } from '@/stores/language'
import { useLoadingStore } from '@/stores/loading'
import { useProjectStore } from '@/stores/project'
import { useTranslationStore } from '@/stores/translation'
import { decPathParam, encPathParam } from '@/utils/path'

const ROW_LINE_HEIGHT = 20
const ROW_TEXTAREA_PADDING = 4
const ROW_BASE_PADDING = 20
const ROW_HEIGHT_PRESETS = [
  { value: 1, label: '低' },
  { value: 2, label: '默认' },
  { value: 4, label: '高' },
  { value: 6, label: '超高' },
] as const
const ROW_HEIGHT_OPTION = 'trans-row-height'
const rowHeightMult = ref<number>(Number(localStorage.getItem(ROW_HEIGHT_OPTION)) || 2)
watch(rowHeightMult, (v) => {
  localStorage.setItem(ROW_HEIGHT_OPTION, String(v))
})
const rowHeight = computed(() => rowHeightMult.value * ROW_LINE_HEIGHT + ROW_TEXTAREA_PADDING + ROW_BASE_PADDING)

function RowHeightIcon({ lines }: { lines: number }) {
  const left = (
    <>
      <path d="M8 4v16" />
      <path d="M4 8 8 4l4 4" />
      <path d="M4 16 8 20l4-4" />
    </>
  )
  let right: VNode
  switch (lines) {
    case 1:
      right = (
        <>
          <path d="M14 17h8" />
          <path d="M18 4v12" />
          <path d="M15 13l3 3 3-3" />
        </>
      )
      break
    case 4:
      right = (
        <>
          <rect x="14" y="5" width="8" height="8" rx="1" />
          <path d="M14 18h8" />
        </>
      )
      break
    case 6:
      right = (
        <>
          <path d="M14 17h8" />
          <path d="M18 13V4" />
          <path d="M15 7l3-3 3 3" />
        </>
      )
      break
    default:
      right = (
        <>
          <path d="M14 7h8" />
          <path d="M14 12h8" />
          <path d="M14 17h8" />
        </>
      )
  }
  return (
    <svg class="row-height-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      {left}
      {right}
    </svg>
  )
}

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

const filters = reactive({ search: '' })
const filterTags = ref<string[]>([])
const allTags = ref<string[]>([])
const untransOnly = ref(false)
const globalLang = ref('')
const rowLangs = ref<string[]>([])
const showCreateDialog = ref(false)
const saving = ref(false)
const form = reactive({ translationKey: '', tags: [] as string[] })
const expandDialog = reactive<{
  visible: boolean
  field: 'key' | 'source' | 'translation' | 'context'
  row: GroupedRow | null
  langCode?: string
}>({ visible: false, field: 'key', row: null })
const expandText = ref('')
const editCache = reactive<Record<string, string>>({})
const composing = ref(false)

const appliedSearch = ref('')
const hasFilter = computed(() => !!appliedSearch.value || filterTags.value.length > 0 || untransOnly.value)
const dragOrderable = ref(true)
const dragKeyId = ref('')
const dragTargetIndex = ref(-1)
const dragGhost = ref<{ key: string, source: string } | null>(null)
const dragPos = reactive({ x: 0, y: 0 })
const dragLine = reactive({ top: 0, left: 0, width: 0 })
const tableWrapEl = ref<HTMLElement | null>(null)
const tableHeight = ref(0)
const tableWidth = ref(0)
const scrollTopRef = ref(0)
const scrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | undefined

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
watch(editableLangs, (langs) => {
  if (langs.length && (!globalLang.value || !langs.some(l => l.languageCode === globalLang.value))) {
    globalLang.value = langs[0].languageCode
    load()
  }
})
function syncRowLangs() {
  rowLangs.value = rows.value.map(() => globalLang.value || editableLangs.value[0]?.languageCode || '')
}

async function load() {
  dragOrderable.value = !hasFilter.value
  loadingStore.start()
  try {
    const lang = globalLang.value || editableLangs.value[0]?.languageCode
    const isRowSearch = appliedSearch.value.startsWith('#')
    await transStore.fetchTranslations(projectSlug.value, {
      page: 1,
      pageSize: -1,
      languageCode: untransOnly.value ? lang : undefined,
      untransOnly: untransOnly.value,
      tags: filterTags.value.length ? filterTags.value.join(',') : undefined,
      search: isRowSearch ? undefined : appliedSearch.value,
    })
    if (isRowSearch) {
      const q = appliedSearch.value.slice(1)
      const isRange = q.includes('-')
      const start = parseInt(q.split('-')[0])
      const end = isRange ? (parseInt(q.split('-')[1]) || 99999) : start
      if (!isNaN(start)) {
        rows.value = rows.value.filter(r => isRange ? (r.rowIndex >= start && r.rowIndex <= end) : r.rowIndex === start)
        total.value = isRange ? (end - start + 1) : 1
      }
    }
    syncRowLangs()
  }
  finally {
    loadingStore.stop()
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

function onResize({ height, width }: { height: number, width: number }) {
  tableHeight.value = height
  tableWidth.value = width
}
function onTableScroll({ scrollTop }: { scrollTop: number }) {
  scrollTopRef.value = scrollTop
  scrolling.value = true
  if (scrollTimer)
    clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    scrolling.value = false
  }, 600)
}

let dragStart: { index: number, keyId: string, y: number } | null = null
let dragRaf = 0
let dragClientY = 0
function onDragStart(e: PointerEvent, index: number, keyId: string) {
  if (!dragOrderable.value || !perm.canReorderRows.value)
    return
  e.preventDefault()
  dragStart = { index, keyId, y: e.clientY }
  dragKeyId.value = keyId
  dragTargetIndex.value = index
  const row = rows.value.find(r => r.keyId === keyId)
  dragGhost.value = row
    ? { key: row.translationKey, source: row.sourceText }
    : { key: '', source: '' }
  dragPos.x = e.clientX
  dragPos.y = e.clientY
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}
function onDragMove(e: PointerEvent) {
  if (!dragStart)
    return
  dragClientY = e.clientY
  dragPos.x = e.clientX
  dragPos.y = e.clientY
  if (dragRaf)
    return
  dragRaf = requestAnimationFrame(() => {
    dragRaf = 0
    dragStep()
  })
}
function dragStep() {
  const ds = dragStart
  if (!ds)
    return
  const firstVisible = Math.floor(scrollTopRef.value / rowHeight.value)
  const lastVisible = firstVisible + Math.max(1, Math.ceil(tableHeight.value / rowHeight.value) - 1)
  const dy = dragClientY - ds.y
  let target = ds.index + Math.round(dy / rowHeight.value)
  target = Math.max(firstVisible, Math.min(lastVisible, target))
  target = Math.max(0, Math.min(rows.value.length - 1, target))
  dragTargetIndex.value = target
  const wrap = tableWrapEl.value
  if (wrap) {
    const rect = wrap.getBoundingClientRect()
    dragLine.top = rect.top + 44 + (target - firstVisible) * rowHeight.value
    dragLine.left = rect.left
    dragLine.width = rect.width
  }
}
function onDragEnd() {
  if (dragRaf) {
    cancelAnimationFrame(dragRaf)
    dragRaf = 0
  }
  const start = dragStart
  dragStart = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  const keyId = start?.keyId ?? dragKeyId.value
  dragKeyId.value = ''
  dragGhost.value = null
  const target = dragTargetIndex.value
  dragTargetIndex.value = -1
  if (!start || target < 0)
    return
  const from = rows.value.findIndex(r => r.keyId === keyId)
  if (from < 0) {
    load()
    return
  }
  if (from === target)
    return
  const clone = [...rows.value]
  const [moved] = clone.splice(from, 1)
  clone.splice(target, 0, moved)
  rows.value = clone
  // 折半插入 moved 行到相邻行 sortOrder 之间；相邻值相同/重叠（间距耗尽）时无空位，
  // 折半结果与邻居相等导致排序不生效，此时从相邻最小值开始整页重排以保留相对位置
  const prev = target > 0 ? clone[target - 1] : null
  const nxt = target < clone.length - 1 ? clone[target + 1] : null
  const prevSo = prev?.sortOrder ?? 0
  const nxtSo = nxt?.sortOrder ?? (prevSo + 1000)
  const so = prev ? Math.round((prevSo + nxtSo) / 2) : Math.round(nxtSo / 2)
  const base = prev ? prevSo : nxtSo
  const orders = (so <= prevSo || (nxt && so >= nxtSo))
    ? clone.map((r, i) => ({ keyId: r.keyId, sortOrder: base + (i + 1) * 10 }))
    : [{ keyId, sortOrder: so }]
  client.put(`/projects/${encPathParam(projectSlug.value)}/translations/sortOrders`, { orders })
    .then(() => ElMessage.success('排序已更新'))
    .catch(() => {
      ElMessage.error('排序更新失败')
      load()
    })
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

async function onTagsChange(row: GroupedRow) {
  try {
    await updateKey(projectSlug.value, row.keyId, { tags: row.tags })
    ElMessage.success('标签已更新')
    loadTags()
  }
  catch {
    ElMessage.error('标签更新失败')
    load()
  }
}

async function onKeySave(row: GroupedRow) {
  const newKey = (editCache[`key|${row.keyId}`] ?? row.translationKey).trim()
  if (!newKey) {
    ElMessage.warning('Key 不能为空')
    return
  }
  if (newKey === row.translationKey) {
    delete editCache[`key|${row.keyId}`]
    return
  }
  try {
    await updateKey(projectSlug.value, row.keyId, { translationKey: newKey, sourceText: row.sourceText })
    row.translationKey = newKey
    delete editCache[`key|${row.keyId}`]
    ElMessage.success('Key 已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Key 更新失败')
  }
}

async function onSourceSave(row: GroupedRow) {
  const newText = editCache[`source|${row.keyId}`] ?? row.sourceText
  if (newText === row.sourceText) {
    delete editCache[`source|${row.keyId}`]
    return
  }
  try {
    await updateKey(projectSlug.value, row.keyId, { sourceText: newText })
    row.sourceText = newText
    delete editCache[`source|${row.keyId}`]
    ElMessage.success('原文已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '原文更新失败')
  }
}

async function onContextSave(row: GroupedRow) {
  const newText = editCache[`context|${row.keyId}`] ?? row.context
  if (newText === row.context) {
    delete editCache[`context|${row.keyId}`]
    return
  }
  try {
    await updateKey(projectSlug.value, row.keyId, { context: newText })
    row.context = newText
    delete editCache[`context|${row.keyId}`]
    ElMessage.success('备注已更新')
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '备注更新失败')
  }
}

async function onTranslationSave(row: GroupedRow, lang: string) {
  if (!lang)
    return
  const ck = `translation|${row.keyId}|${lang}`
  const newText = editCache[ck] ?? ''
  const prev = row.translations[lang]?.translatedText ?? ''
  if (newText === prev) {
    delete editCache[ck]
    return
  }
  try {
    await saveTranslation(projectSlug.value, row.keyId, lang, newText)
    if (row.translations[lang])
      row.translations[lang].translatedText = newText
    else
      row.translations[lang] = { id: '', translatedText: newText }
    delete editCache[ck]
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '译文保存失败')
  }
}

const expandTitle = computed(() => {
  const names = { key: 'Key', source: '原文', translation: '译文', context: '备注' }
  return `编辑${names[expandDialog.field]}`
})

function openExpand(field: 'key' | 'source' | 'translation' | 'context', row: GroupedRow, langCode?: string) {
  expandDialog.field = field
  expandDialog.row = row
  expandDialog.langCode = langCode
  switch (field) {
    case 'key':
      expandText.value = row.translationKey
      break
    case 'source':
      expandText.value = row.sourceText
      break
    case 'context':
      expandText.value = row.context
      break
    case 'translation':
      expandText.value = langCode ? (row.translations[langCode]?.translatedText ?? '') : ''
      break
  }
  expandDialog.visible = true
}

async function saveExpand() {
  const row = expandDialog.row
  if (!row)
    return
  const text = expandText.value
  try {
    switch (expandDialog.field) {
      case 'key': {
        const newKey = text.trim()
        if (!newKey) {
          ElMessage.warning('Key 不能为空')
          return
        }
        await updateKey(projectSlug.value, row.keyId, { translationKey: newKey, sourceText: row.sourceText })
        row.translationKey = newKey
        break
      }
      case 'source':
        await updateKey(projectSlug.value, row.keyId, { sourceText: text })
        row.sourceText = text
        break
      case 'context':
        await updateKey(projectSlug.value, row.keyId, { context: text })
        row.context = text
        break
      case 'translation': {
        const langCode = expandDialog.langCode!
        await saveTranslation(projectSlug.value, row.keyId, langCode, text)
        if (row.translations[langCode])
          row.translations[langCode].translatedText = text
        else
          row.translations[langCode] = { id: '', translatedText: text }
        break
      }
    }
    ElMessage.success('保存成功')
    expandDialog.visible = false
  }
  catch (e: unknown) {
    ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '保存失败')
  }
}

function rowClassName(params: Parameters<RowClassNameGetter<GroupedRow>>[0]): string {
  return params.rowData.keyId === dragKeyId.value ? 'drag-source' : ''
}

const translationColumns = computed<Column<GroupedRow>[]>(() => {
  const FIXED_WIDTHS = { drag: 46, rowIndex: 60, actions: 80 }
  const SCROLLBAR = 10
  const FLEX_MINS: Record<string, number> = { translationKey: 150, sourceText: 150, lang: 110, translation: 170, tags: 130, context: 130 }
  const FLEX_WEIGHTS: Record<string, number> = { translationKey: 2.5, sourceText: 2.5, lang: 1.5, translation: 3, tags: 2, context: 2 }
  const fixedTotal = FIXED_WIDTHS.drag + FIXED_WIDTHS.rowIndex + FIXED_WIDTHS.actions + SCROLLBAR
  const flexKeys = Object.keys(FLEX_WEIGHTS)
  const flexWidths: Record<string, number> = {}
  const available = Math.max(0, tableWidth.value - fixedTotal)
  const minTotal = flexKeys.reduce((s, k) => s + FLEX_MINS[k], 0)
  if (available <= minTotal) {
    flexKeys.forEach((k) => {
      flexWidths[k] = FLEX_MINS[k]
    })
  }
  else {
    const weightTotal = flexKeys.reduce((s, k) => s + FLEX_WEIGHTS[k], 0)
    const extra = available - minTotal
    flexKeys.forEach((k) => {
      flexWidths[k] = FLEX_MINS[k] + Math.floor(extra * FLEX_WEIGHTS[k] / weightTotal)
    })
    const diff = available - flexKeys.reduce((s, k) => s + flexWidths[k], 0)
    if (diff > 0)
      flexWidths.context += diff
  }
  const cols: Column<GroupedRow>[] = []

  if (dragOrderable.value && perm.canReorderRows.value) {
    cols.push({
      key: 'drag',
      width: FIXED_WIDTHS.drag,
      fixed: TableV2FixedDir.LEFT,
      cellRenderer: ({ rowData, rowIndex }) => (
        <span class="drag-handle" style={{ userSelect: 'none' }} onPointerdown={(e: PointerEvent) => onDragStart(e, rowIndex, rowData.keyId)}>⋮⋮</span>
      ),
    })
  }

  cols.push({
    key: 'rowIndex',
    title: '#',
    width: FIXED_WIDTHS.rowIndex,
    align: 'center',
    fixed: TableV2FixedDir.LEFT,
    cellRenderer: ({ rowData, rowIndex }) => <span style={{ whiteSpace: 'nowrap', userSelect: 'none' }}>{String(hasFilter.value ? rowData.rowIndex : rowIndex + 1)}</span>,
  })

  cols.push({
    key: 'translationKey',
    title: 'Key',
    width: flexWidths.translationKey,
    fixed: TableV2FixedDir.LEFT,
    cellRenderer: ({ rowData }) => {
      if (scrolling.value)
        return <span class="cell-scroll-text" style={{ WebkitLineClamp: rowHeightMult.value }} title={rowData.translationKey}>{rowData.translationKey}</span>
      if (perm.canEditKeyColumn.value) {
        return (
          <div class="expand-cell">
            <BaseInput
              class="inline-input"
              modelValue={editCache[`key|${rowData.keyId}`] ?? rowData.translationKey}
              onUpdate:modelValue={(v: string) => editCache[`key|${rowData.keyId}`] = v}
              onCompositionstart={onCompositionStart}
              onCompositionend={onCompositionEnd}
              onBlur={() => handleBlurSave(() => onKeySave(rowData))}
              type="textarea"
              rows={rowHeightMult.value}
              size="small"
            />
            <span class="expand-btn" onClick={() => openExpand('key', rowData)}><BaseIcon><Edit /></BaseIcon></span>
          </div>
        )
      }
      return <span class="cell-text" title={rowData.translationKey}>{rowData.translationKey}</span>
    },
  })

  cols.push({
    key: 'sourceText',
    title: '原文',
    width: flexWidths.sourceText,
    fixed: TableV2FixedDir.LEFT,
    cellRenderer: ({ rowData }) => {
      if (scrolling.value)
        return <span class="cell-scroll-text" style={{ WebkitLineClamp: rowHeightMult.value }} title={rowData.sourceText}>{rowData.sourceText}</span>
      if (perm.canEditSourceColumn.value) {
        return (
          <div class="expand-cell">
            <BaseInput
              class="inline-input"
              modelValue={editCache[`source|${rowData.keyId}`] ?? rowData.sourceText}
              onUpdate:modelValue={(v: string) => editCache[`source|${rowData.keyId}`] = v}
              onCompositionstart={onCompositionStart}
              onCompositionend={onCompositionEnd}
              onBlur={() => handleBlurSave(() => onSourceSave(rowData))}
              type="textarea"
              rows={rowHeightMult.value}
              size="small"
            />
            <span class="expand-btn" onClick={() => openExpand('source', rowData)}><BaseIcon><Edit /></BaseIcon></span>
          </div>
        )
      }
      return <span class="cell-text" title={rowData.sourceText}>{rowData.sourceText}</span>
    },
  })

  cols.push({
    key: 'lang',
    title: '语言',
    width: flexWidths.lang,
    cellRenderer: ({ rowIndex }) => {
      if (scrolling.value)
        return <span class="cell-ph" />
      return (
        <BaseSelect size="small" modelValue={rowLangs.value[rowIndex]} style={{ width: '100%' }} onChange={(v: unknown) => onRowLangChange(rowIndex, v as string)}>
          {(editableLangs.value || []).map(l => <ElOption label={l.alias || l.languageCode} value={l.languageCode} />)}
        </BaseSelect>
      )
    },
  })

  cols.push({
    key: 'translation',
    title: '译文',
    width: flexWidths.translation,
    cellRenderer: ({ rowData, rowIndex }) => {
      const lang = rowLangs.value[rowIndex]
      const text = rowData.translations[lang]?.translatedText ?? ''
      if (scrolling.value)
        return <span class="cell-ph" />
      const ck = `translation|${rowData.keyId}|${lang}`
      return (
        <div class="expand-cell">
          <BaseInput
            class="inline-input"
            modelValue={editCache[ck] ?? text}
            onUpdate:modelValue={(v: string) => editCache[ck] = v}
            onCompositionstart={onCompositionStart}
            onCompositionend={onCompositionEnd}
            onBlur={() => handleBlurSave(() => onTranslationSave(rowData, lang))}
            type="textarea"
            rows={rowHeightMult.value}
            size="small"
            placeholder="输入译文..."
          />
          {lang && <span class="expand-btn" onClick={() => openExpand('translation', rowData, lang)}><BaseIcon><Edit /></BaseIcon></span>}
        </div>
      )
    },
  })

  cols.push({
    key: 'tags',
    title: '标签',
    width: flexWidths.tags,
    cellRenderer: ({ rowData }) => {
      if (scrolling.value)
        return <span class="cell-ph" />
      if (perm.canEditTagsColumn.value) {
        return (
          <BaseTagInput
            size="small"
            options={allTags.value}
            modelValue={rowData.tags}
            onUpdate:modelValue={(v?: string[]) => { rowData.tags = v ?? rowData.tags }}
            onChange={() => onTagsChange(rowData)}
            style={{ width: '100%' }}
          />
        )
      }
      return <span class="cell-text" title={rowData.tags.join(', ')}>{rowData.tags.length ? rowData.tags.join(', ') : '-'}</span>
    },
  })

  cols.push({
    key: 'context',
    title: '备注',
    width: flexWidths.context,
    cellRenderer: ({ rowData }) => {
      if (scrolling.value)
        return <span class="cell-ph" />
      if (perm.canEditContextColumn.value) {
        return (
          <div class="expand-cell">
            <BaseInput
              class="inline-input"
              modelValue={editCache[`context|${rowData.keyId}`] ?? rowData.context}
              onUpdate:modelValue={(v: string) => editCache[`context|${rowData.keyId}`] = v}
              onCompositionstart={onCompositionStart}
              onCompositionend={onCompositionEnd}
              onBlur={() => handleBlurSave(() => onContextSave(rowData))}
              type="textarea"
              rows={rowHeightMult.value}
              size="small"
              placeholder="备注..."
            />
            <span class="expand-btn" onClick={() => openExpand('context', rowData)}><BaseIcon><Edit /></BaseIcon></span>
          </div>
        )
      }
      return <span class="cell-text" title={rowData.context}>{rowData.context || '-'}</span>
    },
  })

  if (perm.canManageKeys.value) {
    cols.push({
      key: 'actions',
      title: '操作',
      width: FIXED_WIDTHS.actions,
      fixed: TableV2FixedDir.RIGHT,
      cellRenderer: ({ rowData }) => scrolling.value ? <span class="cell-ph" /> : <BaseButton link type="danger" size="small" onClick={() => handleDelete(rowData)}>删除</BaseButton>,
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
          <ElOption v-for="l in editableLangs" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="行高">
        <BaseSelect v-model="rowHeightMult" style="width:120px">
          <ElOption v-for="p in ROW_HEIGHT_PRESETS" :key="p.value" :label="p.label" :value="p.value">
            <span class="row-height-opt">
              <RowHeightIcon :lines="p.value" />
              {{ p.label }}
            </span>
          </ElOption>
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="标签筛选">
        <BaseSelect v-model="filterTags" multiple filterable clearable :reserve-keyword="false" placeholder="全部标签" style="width:200px">
          <ElOption v-for="t in allTags" :key="t" class="base-option" :label="t" :value="t" />
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
    <div ref="tableWrapEl" class="trans-table-wrap">
      <Transition name="scroll-hint">
        <div v-show="scrolling" class="scroll-hint">
          <BaseIcon class="scroll-hint-icon">
            <RefreshRight />
          </BaseIcon>
          <span>滚动中，停止滚动恢复显示</span>
        </div>
      </Transition>
      <ElAutoResizer @resize="onResize">
        <template #default="{ height, width }">
          <BaseTableVirtualized
            :loading="loading"
            :class="rowHeightMult > 1 ? 'trans-table row-top' : 'trans-table'"
            :columns="translationColumns"
            :data="rows"
            :width="width"
            :height="height"
            :row-height="rowHeight"
            :header-height="44"
            :cache="8"
            :vertical-scrollbar-size="10"
            scrollbar-always-on
            row-key="keyId"
            fixed
            :row-class="rowClassName"
            @scroll="onTableScroll"
          >
            <template #empty>
              暂无数据
            </template>
          </BaseTableVirtualized>
        </template>
      </ElAutoResizer>
    </div>
    <Teleport to="body">
      <div v-if="dragGhost" class="drag-ghost" :style="{ left: `${dragPos.x + 12}px`, top: `${dragPos.y + 12}px` }">
        <div class="drag-ghost-key">
          {{ dragGhost.key }}
        </div>
        <div v-if="dragGhost.source" class="drag-ghost-source">
          {{ dragGhost.source }}
        </div>
      </div>
      <div v-if="dragKeyId" class="drag-line" :style="{ top: `${dragLine.top}px`, left: `${dragLine.left}px`, width: `${dragLine.width}px` }" />
    </Teleport>
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
    <BaseDialog v-model="expandDialog.visible" :title="expandTitle" width="720px">
      <div v-if="expandDialog.row" class="expand-meta">
        <span class="expand-meta-label">Key</span>
        <span class="expand-meta-value pre-wrap">{{ expandDialog.row.translationKey }}</span>
        <template v-if="expandDialog.langCode">
          <span class="expand-meta-label">语言</span>
          <span class="expand-meta-value">{{ expandDialog.langCode }}</span>
        </template>
      </div>
      <div v-if="expandDialog.field === 'translation'" class="expand-trans">
        <div class="expand-orig">
          <div class="expand-subtitle">
            原文
          </div>
          <div class="expand-orig-text pre-wrap">
            {{ expandDialog.row?.sourceText || '-' }}
          </div>
        </div>
        <div class="expand-edit">
          <div class="expand-subtitle">
            译文
          </div>
          <BaseInput v-model="expandText" type="textarea" :autosize="{ minRows: 10, maxRows: 24 }" placeholder="在此输入内容..." />
        </div>
      </div>
      <BaseInput v-else v-model="expandText" type="textarea" :autosize="{ minRows: 10, maxRows: 24 }" placeholder="在此输入内容..." />
      <template #footer>
        <BaseButton @click="expandDialog.visible = false">
          取消
        </BaseButton><BaseButton type="primary" @click="saveExpand">
          更新
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style lang="scss" scoped>
.trans-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.total-count { color: #909399; font-size: 14px; font-weight: normal; }
.filter-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.filter-bar .el-form-item { margin-bottom: 0; }
.trans-table-wrap { flex: 1; min-height: 0; position: relative; }
.trans-table-wrap :deep(.scroll-hint) { position: absolute; top: 52px; left: 50%; transform: translateX(-50%); z-index: 30; display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; letter-spacing: 1px; color: #fff; background: rgba(64, 158, 255, 0.95); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 4px 16px rgba(64, 158, 255, 0.5); pointer-events: none; white-space: nowrap; }
.trans-table-wrap :deep(.scroll-hint-icon) { font-size: 15px; animation: scroll-hint-spin 1s linear infinite; }
@keyframes scroll-hint-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.scroll-hint-enter-active,
.scroll-hint-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.scroll-hint-enter-from,
.scroll-hint-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
.trans-table :deep(.el-table-v2__row-cell) { padding: 0 8px; display: flex; align-items: center; overflow: hidden; }
.trans-table.row-top :deep(.el-table-v2__row-cell) { align-items: flex-start; padding: 10px 8px; }
.trans-table.row-top :deep(.expand-cell) { align-items: flex-start; }
.trans-table :deep(.el-table-v2__header-cell) { padding: 0 8px; }
.trans-table :deep(.expand-cell) { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.trans-table :deep(.cell-text) { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: #606266; }
.trans-table :deep(.cell-scroll-text) { flex: 1; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-all; font-size: 13px; line-height: 20px; color: #606266; user-select: none; }
.trans-table :deep(.expand-btn) { flex-shrink: 0; display: inline-flex; align-items: center; font-size: 16px; color: #909399; cursor: pointer; }
.trans-table :deep(.expand-btn:hover) { color: #409eff; }
.trans-table :deep(.drag-handle) { color: #c0c4cc; cursor: pointer; user-select: none; font-size: 18px; display: block; text-align: center; line-height: 1; }
.trans-table :deep(.drag-handle:hover) { color: #409eff; }
.trans-table :deep(.drag-source) { background-color: #ecf5ff !important; }
.drag-ghost { position: fixed; z-index: 3000; max-width: 280px; padding: 6px 10px; background: #fff; border: 1px solid #409eff; border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); pointer-events: none; }
.drag-line { position: fixed; height: 2px; background: #409eff; z-index: 3001; pointer-events: none; }
.drag-ghost-key { font-size: 13px; font-weight: 600; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.drag-ghost-source { margin-top: 2px; font-size: 12px; color: #909399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trans-table :deep(.inline-input) { flex: 1; min-width: 0; }
.trans-table.row-top :deep(.inline-input) { height: 100%; }
.trans-table.row-top :deep(.inline-input .el-textarea) { height: 100%; }
.trans-table.row-top :deep(.inline-input .el-textarea__inner) { height: 100%; }
.trans-table :deep(.inline-input .el-textarea__inner) { padding: 2px 6px; font-size: 13px; line-height: 20px; overflow-y: auto; }
.trans-page :deep(textarea) { resize: none; }
.expand-meta { display: grid; grid-template-columns: 48px 1fr; row-gap: 2px; column-gap: 12px; padding: 6px 10px; margin-bottom: 8px; background: #f5f7fa; border-radius: 6px; }
.expand-meta-label { font-size: 13px; color: #909399; line-height: 1.5; white-space: nowrap; }
.expand-meta-value { font-size: 13px; color: #303133; line-height: 1.5; word-break: break-all; }
.expand-trans { display: flex; gap: 10px; }
.expand-trans .expand-orig, .expand-trans .expand-edit { flex: 1; min-width: 0; }
.expand-subtitle { margin-bottom: 4px; font-size: 13px; color: #909399; }
.expand-orig-text { max-height: 420px; overflow: auto; padding: 6px 10px; background: #fafafa; border: 1px solid #e4e7ed; border-radius: 6px; font-size: 13px; color: #606266; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
.row-height-opt { display: inline-flex; align-items: center; gap: 6px; }
.row-height-icon { width: 18px; height: 18px; flex-shrink: 0; }
</style>
