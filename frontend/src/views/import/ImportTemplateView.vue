<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { ImportResult, ProjectLanguage } from '@/types/models'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { BaseButton, BaseCheckbox, BaseDataViewer, BaseForm, BaseFormItem, BaseInput, BaseNotice, BasePageHeader, BaseRadioGroup, BaseSelect, BaseTabs, BaseTabularViewer } from '@/components/ui'
import { ImportFormat } from '@/data/importFormats'
import { useImportStatus } from '@/hooks/useImportStatus'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { formatCount } from '@/utils/format'
import { decPathParam, encPathParam } from '@/utils/path'

const route = useRoute()
const perm = useProjectPermission()
const auth = useAuthStore()
const projectStore = useProjectStore()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const importing = ref(false)
const { isLocked: importLocked, importerId: importLockerId, status: importStatus, load: loadImportStatus, reset: resetImportStatus, statsLines: importStatsLines, importTitle } = useImportStatus(projectSlug, { importing })
const projectLanguages = ref<ProjectLanguage[]>([])
/** 项目源语言（原文列）：翻译导入恒不触碰，目标语言下拉排除之 */
const sourceLanguage = computed(() => projectStore.bySlug[projectSlug.value]?.sourceLanguage ?? '')
/** 可选目标语言 = 项目语言排除源语言 */
const importableLangs = computed(() => projectLanguages.value.filter(l => l.languageCode !== sourceLanguage.value))
/** 导入条目说明（HTML 片段，经 v-dompurify-html 净化后渲染；语义与 importKeys 实现对齐） */
const entriesTipsHtml = [
  '<ul class="tip-list">',
  '  <li>字段名需严格一致：<code>key</code>（必填）、<code>sourceText</code>（原文）、<code>tags</code>（标签，分号分隔）、<code>context</code>（备注）</li>',
  '  <li>文件里的新 Key 将被创建，其原文、备注、标签随条目一并写入</li>',
  '  <li>原文来源：<code>sourceText</code> 字段，或源语言的列/键（代码或代码别名均可，如 <code>zh</code> 即 <code>zh-Hans</code>）</li>',
  '  <li>「覆盖已有条目」勾选行为：',
  '    <ul class="tip-sub">',
  '      <li>未勾选：已存在的 Key 整条跳过，仅新增缺失的 Key</li>',
  '      <li>勾选：更新已有 Key 的原文、备注、标签</li>',
  '    </ul>',
  '  </li>',
  '  <li>各语言的译文始终不改动</li>',
  '</ul>',
].join('\n')
/** 导入翻译说明（HTML 片段）：语言来源 / 未配置语言 / 源语言原文 */
const translateTipsHtml = [
  '<ul class="tip-list">',
  '  <li>语言来源：',
  '    <ul class="tip-sub">',
  '      <li>CSV 语言列与嵌套格式（JSON/YAML/XML）按文件内语言识别</li>',
  '      <li>扁平格式使用上方所选目标语言</li>',
  '    </ul>',
  '  </li>',
  '  <li>支持代码别名：语言列或语言键可使用项目语言的代码别名（如 zh → zh-Hans）</li>',
  '  <li>项目未配置的语言会自动跳过（不会创建）</li>',
  '  <li>源语言即原文列，始终跳过——如需批量更新原文，请使用「导入条目」模式</li>',
  '</ul>',
].join('\n')
const mode = ref('entries')
/** 当前模式的说明 HTML（左侧「导入说明」卡片内容，经 v-dompurify-html 净化渲染） */
const tipsHtml = computed(() => (mode.value === 'entries' ? entriesTipsHtml : translateTipsHtml))
const fmt = ref<string>(ImportFormat.JSON)
const importLang = ref('')
const overwrite = ref(false)
const autoCreate = ref(true)
const aborting = ref(false)
const importFile = ref<File | null>(null)
const notice = ref<{ type: 'success' | 'warning' | 'error', text: string, lines?: string[] } | null>(null)
/** 已消费（展示过成功/失败提示）的导入起始时间戳，避免轮询重复弹窗 */
const consumedTs = ref<number>(0)
/** 本次会话是否由我发起了后台导入（用于判定轮询带回的结果归属） */
const wasImporting = ref(false)
/** 本次导入的模式，决定结果提示用「条目」还是「字段」 */
const importMode = ref<'entries' | 'translate'>('entries')

function setNotice(type: 'success' | 'warning' | 'error', text: string, lines?: string[]) {
  notice.value = { type, text, lines }
}

/** 轮询带回的导入结束结果：未锁定且有 result/error 时展示可关闭提示（按 startTimestamp 去重避免重复弹窗）——本会话发起的用「导入完成：」标题；进页面/刷新后直接读到已完成状态（如进行中刷新、他人历史导入）用「已导入：」标题，统计行一致，避免刷新后错过结果 */
watch(importStatus, (s) => {
  if (!s)
    return
  const startTs = (s.startTimestamp as number) || 0
  const result = s.result ?? null
  const error = s.error ?? null
  if (importLocked.value || !startTs || startTs === consumedTs.value)
    return
  if (error) {
    setNotice(error === '导入已中止' ? 'warning' : 'error', error)
  }
  else if (result) {
    const msg = importSuccessMsg(s.type === 'translations' ? 'translate' : 'entries', result)
    // 一个字段都没写入（如目标语言误选、文件语言全部未配置）时以警告级别展示，提示排查而非默默"成功"
    const wroteNothing = result.createdFields === 0 && result.createdKeys === 0
    setNotice(wroteNothing ? 'warning' : 'success', wroteNothing ? '导入完成：未写入任何译文' : (wasImporting.value ? msg.title : '已导入：'), msg.lines)
  }
  else {
    return
  }
  consumedTs.value = startTs
  wasImporting.value = false
})
watch(projectSlug, () => {
  wasImporting.value = false
  consumedTs.value = 0
})
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
const fileAccept = computed(() => {
  if (mode.value === 'entries')
    return '.json,.csv,.yaml,.yml,.xml'
  // 译文模式：文件导入按扩展名自动识别格式（properties 不自带语言、需手动选语言，仅文本模式支持），故放开其余类型；文本导入由用户手动选格式
  if (inputMode.value === 'file')
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
  importLang.value = importableLangs.value[0]?.languageCode ?? ''
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

/** 组装导入成功提示：导入译文用字段/条目双维度，导入条目仅用条目（键）维度，未配置语言单独成行 */
function importSuccessMsg(mode: 'entries' | 'translate', d1: ImportResult) {
  const lines: string[] = []
  if (mode === 'translate')
    lines.push(`字段：总 ${formatCount(d1.importedFields)} 个，新增 ${formatCount(d1.createdFields)} 个，跳过 ${formatCount(d1.skippedFields)} 个`)
  lines.push(`条目：总 ${formatCount(d1.importedKeys)} 条，新增 ${formatCount(d1.createdKeys)} 条，跳过 ${formatCount(d1.skippedKeys)} 个`)
  const langs = d1.skippedLanguages || []
  if (langs.length)
    lines.push(`以下语言项目未配置，已跳过导入：${langs.join('、')}`)
  if (d1.sourceSkippedFields)
    lines.push(`源语言译文 ${formatCount(d1.sourceSkippedFields)} 个已跳过（对应原文列，不随翻译导入修改）`)
  return { title: '导入完成：', lines }
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
  notice.value = null
  resetImportStatus()
  try {
    const endpoint = mode.value === 'entries' ? 'entries' : 'translations'
    importMode.value = mode.value === 'entries' ? 'entries' : 'translate'
    const body: Record<string, unknown> = mode.value === 'entries'
      ? { data: textInput.value, overwrite: overwrite.value }
      : { data: textInput.value, formatType: fmt.value, languageCode: importLang.value, overwrite: overwrite.value, autoCreate: autoCreate.value }
    textInput.value = ''
    await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/${endpoint}`, body, { timeout: 600000 })
    // POST 成功（accepted）才视为“我发起了导入”；提交失败（如 Conflict）若不复位会误认领后续历史结果
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
  notice.value = null
  resetImportStatus()
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
    // 服务端已接受中止，直接给出确认提示，避免依赖 SSE/轮询最终态才弹窗（否则 inImport 横幅消失后无提示）
    setNotice('warning', '导入已中止')
    wasImporting.value = false
    consumedTs.value = (importStatus.value?.startTimestamp as number) || consumedTs.value
  }
  catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    setNotice('warning', err.response?.data?.message || '中止请求发送失败')
  }
  finally { aborting.value = false }
}
</script>

<template>
  <div class="import-page">
    <BasePageHeader title="导入" />

    <div class="import-ops">
      <BaseForm :inline="true" class="import-bar">
        <BaseFormItem label="模式">
          <BaseRadioGroup v-model="mode" button :options="[{ label: '导入条目', value: 'entries' }, { label: '导入翻译', value: 'translate' }]" />
        </BaseFormItem>
      </BaseForm>

      <BaseNotice v-if="notice" :type="notice.type" :title="notice.text" :lines="notice.lines" @close="notice = null" />
      <BaseNotice v-else-if="lockedElsewhere" type="warning" :closable="false" :title="importTitle" :lines="importStatsLines" />
      <BaseNotice v-if="inImport && importTitle" type="info" :closable="false" :title="importTitle" :lines="importStatsLines">
        <BaseButton type="warning" :loading="aborting" style="margin-top:8px" @click="doAbort">
          中止导入
        </BaseButton>
      </BaseNotice>

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
              <el-option v-for="l in importableLangs" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
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
      <div v-if="inputMode === 'text'" style="margin-bottom:12px">
        <BaseInput v-model="textInput" type="textarea" :rows="12" placeholder="在此粘贴或输入导入内容..." :disabled="!perm.canManageContent.value || importDisabled" style="font-family:monospace;font-size:13px" />
        <BaseButton type="success" :loading="importing" :disabled="!perm.canManageContent.value || importDisabled" style="margin-top:8px" @click="doTextImport">
          开始导入
        </BaseButton>
      </div>
    </div>

    <div class="import-zone">
      <el-card class="zone-card--tips" header="导入说明">
        <div class="tip-body" v-dompurify-html="tipsHtml" />
      </el-card>
      <el-card class="zone-card--format" header="格式说明">
        <template v-if="mode === 'entries'">
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
          <BaseDataViewer v-if="isJsonExample" :data="exampleText" lang="json" max-height="400px" />
          <BaseDataViewer v-else-if="isYamlExample" :data="exampleText" lang="yaml" max-height="400px" />
          <BaseDataViewer v-else-if="isXmlExample" :data="exampleText" lang="xml" max-height="400px" />
          <BaseTabularViewer v-else-if="isCsvExample" :data="exampleText" format="csv" max-height="400px" />
          <BaseTabularViewer v-else-if="isPropertiesExample" :data="exampleText" format="properties" max-height="400px" />
          <pre v-else class="ex-pre">{{ exampleText }}</pre>
        </template>
      </el-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.import-page { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.import-ops { flex: none; overflow: auto; }
.import-zone { flex: 1; min-height: 200px; margin-top: 12px; display: flex; gap: 12px; }
.import-zone .el-card { min-width: 0; display: flex; flex-direction: column; }
.zone-card--tips { flex: 0 0 420px; }
.zone-card--format { flex: 1; }
.import-zone :deep(.el-card__body) { flex: 1; min-height: 0; overflow: auto; }
.tip-body { font-size: 13px; color: #606266; }
.tip-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.tip-sub { margin: 6px 0 0; }
.tip-body code { padding: 0 5px; background: #f5f7fa; border: 1px solid #e4e7ed; border-radius: 4px; font-size: 12px; font-family: Consolas, Menlo, monospace; color: #476582; }
.import-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
.import-bar .el-form-item { margin-bottom: 0; }
.ex-pre { font-size:13px; white-space:pre-wrap; margin:0; }
</style>
