<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { ImportProgress, ImportResult, ProjectLanguage } from '@/types/models'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { BaseButton, BaseCheckbox, BaseDataViewer, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseRadioGroup, BaseSelect, BaseTabs, BaseTabularViewer } from '@/components/ui'
import { ImportFormat } from '@/data/importFormats'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { decPathParam, encPathParam } from '@/utils/path'

const route = useRoute()
const perm = useProjectPermission()
const auth = useAuthStore()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const projectLanguages = ref<ProjectLanguage[]>([])
const mode = ref('entries')
const fmt = ref<string>(ImportFormat.JSON)
const importLang = ref('')
const overwrite = ref(false)
const autoCreate = ref(true)
const importing = ref(false)
const aborting = ref(false)
const importFile = ref<File | null>(null)
const notice = ref<{ type: 'success' | 'warning' | 'error', text: string } | null>(null)
const importLocked = ref(false)
const importLocker = ref('')
const importLockerId = ref('')
const importLockType = ref('')
const importProgress = ref<ImportProgress | null>(null)
/** 已消费（展示过成功/失败提示）的导入起始时间戳，避免轮询重复弹窗 */
const consumedTs = ref<number>(0)
/** 本次会话是否由我发起了后台导入（用于判定轮询带回的结果归属） */
const wasImporting = ref(false)
/** 本次导入的模式，决定结果提示用「条目」还是「字段」 */
const importMode = ref<'entries' | 'translate'>('entries')

function setNotice(type: 'success' | 'warning' | 'error', text: string) {
  notice.value = { type, text }
}

/** 拉取项目导入状态：被他人/其他标签页占用时禁用导入并提示（导入进行中为 10 分钟级，切页后仍可能在导） */
async function loadImportStatus() {
  try {
    const { data: res } = await client.get(`/projects/${encPathParam(projectSlug.value)}/imports/status`)
    importLocked.value = !!res.data?.locked
    importLocker.value = res.data?.startUsername || ''
    importLockerId.value = res.data?.startUserId || ''
    importLockType.value = res.data?.type || ''
    importProgress.value = res.data?.progress || null
    const startTs = (res.data?.startTimestamp as number) || 0
    const result = (res.data?.result ?? null) as ImportResult | null
    const error = (res.data?.error ?? null) as string | null
    if (wasImporting.value && !importLocked.value && startTs && startTs !== consumedTs.value) {
      if (error)
        setNotice(error === '导入已中止' ? 'warning' : 'error', error)
      else if (result)
        setNotice('success', importSuccessMsg(importMode.value, result))
      consumedTs.value = startTs
      wasImporting.value = false
    }
  }
  catch {
    importLocked.value = false
    importLocker.value = ''
    importLockerId.value = ''
    importLockType.value = ''
    importProgress.value = null
  }
}
let statusTimer: ReturnType<typeof setInterval> | undefined
function startStatusTimer(intervalMs: number) {
  clearInterval(statusTimer)
  statusTimer = setInterval(loadImportStatus, intervalMs)
}
watch(projectSlug, () => {
  importLocked.value = false
  importLocker.value = ''
  importLockerId.value = ''
  importLockType.value = ''
  importProgress.value = null
  wasImporting.value = false
  consumedTs.value = 0
  loadImportStatus()
  startStatusTimer(importLocked.value ? 2000 : 30000)
}, { immediate: true })
watch(importLocked, () => {
  startStatusTimer(importLocked.value ? 2000 : 30000)
})
onBeforeUnmount(() => clearInterval(statusTimer))
const exampleTab = ref('json')
const inputMode = ref('file')
const textInput = ref('')

const needLang = computed(() => mode.value === 'translate' && (fmt.value === ImportFormat.JSON || fmt.value === ImportFormat.Properties))
/** 当前用户是否为该导入的发起人（跨标签页也能中止） */
const iAmImporter = computed(() => importLocked.value && !!importLockerId.value && importLockerId.value === auth.user?.id)
/** 我正在导入：本地提交中（POST 进行中）或 status 确认我是发起人（跨标签页） */
const inImport = computed(() => importing.value || iAmImporter.value)
/** 项目被他人/其他标签页占用导入（自己发起的导入不视为被锁） */
const lockedElsewhere = computed(() => importLocked.value && !iAmImporter.value)
/** 导入进行中（无论发起人是谁）时禁用全部表单控件 */
const importDisabled = computed(() => importLocked.value)
const lockTypeName = computed(() => importLockType.value === 'translations' ? '翻译' : '条目')
/** 锁定的导入类型与当前页模式一致时提示「正在导入」，否则提示发起人正在导入 */
const lockTip = computed(() => {
  if (!lockedElsewhere.value)
    return ''
  const sameType = importLockType.value === (mode.value === 'entries' ? 'entries' : 'translations')
  const prefix = sameType
    ? '该项目正在导入中'
    : (importLocker.value ? `${importLocker.value} 正在导入${lockTypeName.value}` : '该项目正在被其他导入占用')
  const p = importProgress.value
  if (!p)
    return `${prefix}，请稍候再试`
  const isTranslate = importLockType.value === 'translations'
  if (p.phase === 'parsing')
    return `${prefix}，解析中（${p.parsedKeys.toLocaleString()} 条目 / ${p.parsedFields.toLocaleString()} 字段），请稍候再试`
  if (p.phase === 'writing') {
    if (isTranslate)
      return `${prefix}，写入中（${p.createdFields.toLocaleString()} 字段新增 / ${p.skippedFields.toLocaleString()} 字段跳过，共 ${p.totalFields.toLocaleString()} 字段），请稍候再试`
    return `${prefix}，写入中（${p.createdKeys.toLocaleString()} 条目新增 / ${p.skippedKeys.toLocaleString()} 条目跳过，共 ${p.totalKeys.toLocaleString()} 条目），请稍候再试`
  }
  return `${prefix}，写入完成，请稍候再试`
})
/** 当前导入进度提示（自己发起的导入，显示实时进度） */
const myImportTip = computed(() => {
  if (!inImport.value)
    return ''
  const p = importProgress.value
  if (!p)
    return '正在提交导入任务，请稍候…'
  const isTranslate = importLockType.value === 'translations'
  const typeLabel = isTranslate ? '翻译' : '条目'
  if (p.phase === 'parsing')
    return `正在导入${typeLabel}：解析中（${p.parsedKeys.toLocaleString()} 条目 / ${p.parsedFields.toLocaleString()} 字段）`
  if (p.phase === 'writing') {
    if (isTranslate)
      return `正在导入${typeLabel}：写入中（${p.createdFields.toLocaleString()} 字段新增 / ${p.skippedFields.toLocaleString()} 字段跳过，共 ${p.totalFields.toLocaleString()} 字段）`
    return `正在导入${typeLabel}：写入中（${p.createdKeys.toLocaleString()} 条目新增 / ${p.skippedKeys.toLocaleString()} 条目跳过，共 ${p.totalKeys.toLocaleString()} 条目）`
  }
  return `正在导入${typeLabel}：写入完成`
})
const fileAccept = computed(() => {
  if (mode.value === 'entries')
    return '.json,.csv,.yaml,.yml,.xml'
  if (fmt.value === 'auto')
    return '.json,.csv,.yaml,.yml,.xml'
  if (fmt.value === ImportFormat.CSV)
    return '.csv'
  if (fmt.value === ImportFormat.Properties)
    return '.properties'
  if (fmt.value === ImportFormat.YAML)
    return '.yaml,.yml'
  if (fmt.value === ImportFormat.XML)
    return '.xml'
  return '.json'
})

const fmtNames: Record<string, string> = { [ImportFormat.JSON]: 'JSON', [ImportFormat.CSV]: 'CSV', [ImportFormat.Properties]: 'Properties', [ImportFormat.YAML]: 'YAML', [ImportFormat.XML]: 'XML' }
const exampleTitle = computed(() => fmtNames[fmt.value] || fmt.value)

const entriesExample = {
  json: '{\n  "login.title": { "sourceText": "登录遇到问题？", "tags": ["auth", "ui"], "context": "登录弹窗标题" },\n  "error.network": { "tags": ["network"] }\n}',
  csv: 'key,sourceText,tags,context\nlogin.title,登录遇到问题？,auth;ui,登录弹窗标题\nerror.network,,network,',
  yaml: 'login.title:\n  sourceText: 登录遇到问题？\n  tags: [auth, ui]\n  context: 登录弹窗标题\nerror.network:\n  tags: [network]',
  xml: '<resources>\n  <string name="login.title" sourceText="登录遇到问题？" tags="auth;ui" context="登录弹窗标题" />\n  <string name="error.network" tags="network" />\n</resources>',
}

const exampleText = computed(() => {
  switch (fmt.value) {
    case ImportFormat.JSON: return '{\n  "zh-Hans": { "login.title": "登录" },\n  "en-US": { "login.title": "Login" }\n}'
    case ImportFormat.CSV: return 'key,zh-Hans,en-US\nlogin.title,登录,Login'
    case ImportFormat.Properties: return 'login.title=Login\nerror.network=Network Error'
    case ImportFormat.YAML: return 'zh-Hans:\n  login.title: 登录\nen-US:\n  login.title: Login'
    case ImportFormat.XML: return '<resources>\n  <language code="zh-Hans">\n    <string name="login.title">登录</string>\n  </language>\n  <language code="en-US">\n    <string name="login.title">Login</string>\n  </language>\n</resources>'
    default: return ''
  }
})

const isJsonExample = computed(() => fmt.value === ImportFormat.JSON)
const isCsvExample = computed(() => fmt.value === ImportFormat.CSV)
const isPropertiesExample = computed(() => fmt.value === ImportFormat.Properties)
const isYamlExample = computed(() => fmt.value === ImportFormat.YAML)
const isXmlExample = computed(() => fmt.value === ImportFormat.XML)

async function loadLanguages() {
  const { data: res } = await client.get(`/projects/${encPathParam(projectSlug.value)}/languages`)
  projectLanguages.value = res.data || []
  if (projectLanguages.value.length)
    importLang.value = projectLanguages.value[0].languageCode
}
watch(projectSlug, () => {
  importFile.value = null
  textInput.value = ''
  loadLanguages()
}, { immediate: true })

const extMap: Record<string, string> = {
  json: ImportFormat.JSON,
  csv: ImportFormat.CSV,
  properties: ImportFormat.Properties,
  yaml: ImportFormat.YAML,
  yml: ImportFormat.YAML,
  xml: ImportFormat.XML,
}

function onFileChange(file: UploadFile) {
  const raw = file.raw ?? null
  importFile.value = raw
  if (mode.value === 'translate' && raw) {
    const ext = raw.name.split('.').pop()?.toLowerCase() ?? ''
    if (extMap[ext])
      fmt.value = extMap[ext]
  }
}

/** 展示导入失败的具体原因：优先服务端 message，其次按 HTTP 状态/超时给出明确提示 */
function showImportError(e: unknown) {
  const err = e as { response?: { data?: { message?: string }, status?: number }, code?: string, message?: string }
  if (err.response?.data?.message) {
    if (err.response.data.message === '导入已中止')
      setNotice('warning', '导入已中止，已写入的数据保留，后续批次停止处理')
    else
      setNotice('error', err.response.data.message)
    return
  }
  if (err.response?.status === 413) {
    setNotice('error', '请求体过大：单次导入内容超出大小限制，请拆分文件后再试')
    return
  }
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || ''))
    setNotice('error', '导入请求超时：请到翻译列表确认数据是否已写入，避免重复提交')
  else
    setNotice('error', '导入失败')
}

/** 组装导入成功提示：导入条目用 keys（记录数），导入翻译用 fields（字段数）；created/skipped 的键维度为去重键数 */
function importSuccessMsg(mode: 'entries' | 'translate', d1: ImportResult) {
  const total = mode === 'entries' ? d1.importedKeys : d1.importedFields
  const unit = mode === 'entries' ? '条目' : '字段'
  const parts = [`导入完成: ${total} 个${unit}`]
  if (d1.created)
    parts.push(`${d1.created} 个${unit}新增${d1.createdKeys ? `（${d1.createdKeys} 个键）` : ''}`)
  if (d1.skipped) {
    const langs = d1.skippedLanguages || []
    parts.push(`${d1.skipped} 个${unit}跳过${d1.skippedKeys ? `（${d1.skippedKeys} 个键）` : ''}${langs.length ? `（含未配置语言 ${langs.join('、')}）` : '（已有）'}`)
  }
  return parts.join('，')
}

async function doTextImport() {
  if (!textInput.value.trim()) {
    setNotice('warning', '请输入内容')
    return
  }
  if (mode.value === 'translate' && needLang.value && !importLang.value) {
    setNotice('warning', '请选择语言')
    return
  }
  importing.value = true
  loadImportStatus()
  try {
    const endpoint = mode.value === 'entries' ? 'entries' : 'translations'
    importMode.value = mode.value === 'entries' ? 'entries' : 'translate'
    const body: Record<string, unknown> = mode.value === 'entries'
      ? { data: textInput.value, overwrite: overwrite.value }
      : { data: textInput.value, formatType: fmt.value, languageCode: importLang.value, overwrite: overwrite.value, autoCreate: autoCreate.value }
    textInput.value = ''
    await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/${endpoint}`, body, { timeout: 600000 })
    wasImporting.value = true
  }
  catch (e: unknown) { showImportError(e) }
  finally {
    importing.value = false
    loadImportStatus()
  }
}

async function doImport() {
  if (!importFile.value) {
    setNotice('warning', '请选择文件')
    return
  }
  if (mode.value === 'translate' && needLang.value && !importLang.value) {
    setNotice('warning', '请选择语言')
    return
  }
  const file = importFile.value
  importFile.value = null
  importing.value = true
  loadImportStatus()
  try {
    const text = await file.text()
    const endpoint = mode.value === 'entries' ? 'entries' : 'translations'
    importMode.value = mode.value === 'entries' ? 'entries' : 'translate'
    const body: Record<string, unknown> = mode.value === 'entries'
      ? { data: text, overwrite: overwrite.value }
      : { data: text, formatType: fmt.value, languageCode: importLang.value, overwrite: overwrite.value, autoCreate: autoCreate.value }
    await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/${endpoint}`, body, { timeout: 600000 })
    wasImporting.value = true
  }
  catch (e: unknown) { showImportError(e) }
  finally {
    importing.value = false
    loadImportStatus()
  }
}

/** 中止当前正在进行的导入（服务端会在批次间检查并抛错，锁随之释放） */
async function doAbort() {
  if (aborting.value)
    return
  aborting.value = true
  try {
    await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/abort`)
  }
  catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    setNotice('warning', err.response?.data?.message || '中止请求发送失败')
  }
  finally { aborting.value = false }
}
</script>

<template>
  <div>
    <BasePageHeader title="导入" />

    <BaseForm :inline="true" class="import-bar">
      <BaseFormItem label="模式">
        <BaseRadioGroup v-model="mode" button :options="[{ label: '导入条目', value: 'entries' }, { label: '导入翻译', value: 'translate' }]" />
      </BaseFormItem>
    </BaseForm>

    <el-alert v-if="notice" :type="notice.type" :closable="true" :title="notice.text" show-icon style="margin-bottom:16px" @close="notice = null" />
    <el-alert v-else-if="lockedElsewhere" type="warning" :closable="false" show-icon :title="lockTip" style="margin-bottom:16px" />
    <el-alert v-if="inImport && myImportTip" type="info" :closable="false" show-icon style="margin-bottom:16px">
      <template #title>
        <div style="display:flex;align-items:center;gap:12px">
          <span>{{ myImportTip }}</span>
          <BaseButton type="warning" :loading="aborting" @click="doAbort">
            中止导入
          </BaseButton>
        </div>
      </template>
    </el-alert>

    <BaseForm :inline="true" class="import-bar" style="margin-top:0">
      <template v-if="mode === 'translate'">
        <BaseFormItem v-if="inputMode === 'text'" label="格式">
          <BaseSelect v-model="fmt" :disabled="importDisabled" style="width:160px">
            <el-option class="base-option" label="JSON" :value="ImportFormat.JSON" />
            <el-option class="base-option" label="CSV" :value="ImportFormat.CSV" />
            <el-option class="base-option" label="Properties" :value="ImportFormat.Properties" />
            <el-option class="base-option" label="YAML" :value="ImportFormat.YAML" />
            <el-option class="base-option" label="XML" :value="ImportFormat.XML" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem v-if="needLang" label="语言">
          <BaseSelect v-model="importLang" :disabled="importDisabled" style="width:160px">
            <el-option v-for="l in projectLanguages" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem>
          <BaseCheckbox v-model="autoCreate" :disabled="importDisabled">
            自动补全新条目
          </BaseCheckbox>
        </BaseFormItem>
      </template>
      <BaseFormItem>
        <BaseCheckbox v-model="overwrite" :disabled="importDisabled">
          {{ mode === 'entries' ? '覆盖已有条目' : '覆盖已有译文' }}
        </BaseCheckbox>
      </BaseFormItem>
      <BaseFormItem>
        <BaseRadioGroup v-model="inputMode" button :options="[{ label: '文件', value: 'file' }, { label: '文本', value: 'text' }]" />
      </BaseFormItem>
      <BaseFormItem v-if="inputMode === 'file'">
        <el-upload :auto-upload="false" :show-file-list="false" :accept="fileAccept" @change="onFileChange">
          <BaseButton type="primary" :disabled="!perm.canManageContent.value || importDisabled">
            选择文件
          </BaseButton>
        </el-upload>
      </BaseFormItem>
      <BaseFormItem v-if="importFile && inputMode === 'file'">
        <BaseButton type="success" :loading="importing" :disabled="!perm.canManageContent.value || importDisabled" @click="doImport">
          开始导入
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
    <div v-if="importFile && inputMode === 'file'" style="font-size:13px;color:#909399;margin-bottom:12px">
      已选: {{ importFile.name }}
    </div>
    <div v-if="inputMode === 'text'" style="margin-bottom:16px">
      <BaseInput v-model="textInput" type="textarea" :rows="12" placeholder="在此粘贴或输入导入内容..." :disabled="!perm.canManageContent.value || importDisabled" style="font-family:monospace;font-size:13px" />
      <BaseButton type="success" :loading="importing" :disabled="!perm.canManageContent.value || importDisabled" style="margin-top:8px" @click="doTextImport">
        开始导入
      </BaseButton>
    </div>
    <el-alert v-if="mode === 'entries'" type="info" :closable="false" style="margin-bottom:16px" title="导入条目不会更改现有条目的翻译内容" />

    <el-card header="格式说明" style="margin-top:16px">
      <template v-if="mode === 'entries'">
        <p style="margin:0 0 12px;font-size:13px;color:#909399">
          字段（名称需严格一致）: key(必填) / sourceText(原文) / tags(标签;分隔) / context(备注)
        </p>
        <BaseTabs v-model="exampleTab" type="card" :tabs="[{ key: 'json', label: 'JSON' }, { key: 'csv', label: 'CSV' }, { key: 'yaml', label: 'YAML' }, { key: 'xml', label: 'XML' }]">
          <template #tab-json>
            <BaseDataViewer :data="entriesExample.json" lang="json" max-height="400px" />
          </template>
          <template #tab-csv>
            <BaseTabularViewer :data="entriesExample.csv" format="csv" max-height="400px" />
          </template>
          <template #tab-yaml>
            <BaseDataViewer :data="entriesExample.yaml" lang="yaml" max-height="400px" />
          </template>
          <template #tab-xml>
            <BaseDataViewer :data="entriesExample.xml" lang="xml" max-height="400px" />
          </template>
        </BaseTabs>
      </template>
      <template v-else>
        <p style="margin:0 0 8px;font-size:13px;color:#909399">
          {{ exampleTitle }}
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#909399">
          项目未配置的语言代码将自动跳过
        </p>
        <p v-if="isCsvExample" style="margin:0 0 8px;font-size:13px;color:#909399">
          CSV 语言列与嵌套格式以数据中的语言为准
        </p>
        <BaseDataViewer v-if="isJsonExample" :data="exampleText" lang="json" max-height="400px" />
        <BaseDataViewer v-else-if="isYamlExample" :data="exampleText" lang="yaml" max-height="400px" />
        <BaseDataViewer v-else-if="isXmlExample" :data="exampleText" lang="xml" max-height="400px" />
        <BaseTabularViewer v-else-if="isCsvExample" :data="exampleText" format="csv" max-height="400px" />
        <BaseTabularViewer v-else-if="isPropertiesExample" :data="exampleText" format="properties" max-height="400px" />
        <pre v-else class="ex-pre">{{ exampleText }}</pre>
      </template>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.import-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.import-bar .el-form-item { margin-bottom: 0; }
.ex-pre { font-size:13px; white-space:pre-wrap; margin:0; }
</style>
