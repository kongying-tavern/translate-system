<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { ProjectLanguage } from '@/types/models'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { BaseButton, BaseCheckbox, BaseDataViewer, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseRadioGroup, BaseSelect, BaseTabs, BaseTabularViewer } from '@/components/ui'
import { ImportFormat } from '@/data/importFormats'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { decPathParam, encPathParam } from '@/utils/path'

const route = useRoute()
const perm = useProjectPermission()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const projectLanguages = ref<ProjectLanguage[]>([])
const mode = ref('entries')
const fmt = ref<string>(ImportFormat.JSON)
const importLang = ref('')
const overwrite = ref(false)
const autoCreate = ref(true)
const importing = ref(false)
const importFile = ref<File | null>(null)
const exampleTab = ref('json')
const inputMode = ref('file')
const textInput = ref('')

const needLang = computed(() => mode.value === 'translate' && (fmt.value === ImportFormat.JSON || fmt.value === ImportFormat.Properties))
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
    ElMessage.error(err.response.data.message)
    return
  }
  if (err.response?.status === 413) {
    ElMessage.error('请求体过大：单次导入内容超出大小限制（50MB），请拆分文件后再试')
    return
  }
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || ''))
    ElMessage.error('导入请求超时：请到翻译列表确认数据是否已写入，避免重复提交')
  else
    ElMessage.error('导入失败')
}

/** 组装导入成功提示：含新增/跳过统计与未配置语言列表 */
function importSuccessMsg(d1: { imported: number, created: number, skipped: number, skippedLanguages?: string[] }) {
  const parts = [`导入完成: ${d1.imported} 条`]
  if (d1.created)
    parts.push(`${d1.created} 新增`)
  if (d1.skipped) {
    const langs = d1.skippedLanguages || []
    parts.push(`${d1.skipped} 跳过${langs.length ? `（含未配置语言 ${langs.join('、')}）` : '（已有）'}`)
  }
  return parts.join('，')
}

async function doTextImport() {
  if (!textInput.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  if (mode.value === 'translate' && needLang.value && !importLang.value) {
    ElMessage.warning('请选择语言')
    return
  }
  importing.value = true
  try {
    const endpoint = mode.value === 'entries' ? 'entries' : 'translations'
    const body: Record<string, unknown> = mode.value === 'entries'
      ? { data: textInput.value, overwrite: overwrite.value }
      : { data: textInput.value, formatType: fmt.value, languageCode: importLang.value, overwrite: overwrite.value, autoCreate: autoCreate.value }
    const { data: res } = await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/${endpoint}`, body, { timeout: 300000 })
    ElMessage.success(importSuccessMsg(res.data))
    textInput.value = ''
  }
  catch (e: unknown) { showImportError(e) }
  finally { importing.value = false }
}

async function doImport() {
  if (!importFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  if (mode.value === 'translate' && needLang.value && !importLang.value) {
    ElMessage.warning('请选择语言')
    return
  }
  importing.value = true
  try {
    const text = await importFile.value.text()
    const endpoint = mode.value === 'entries' ? 'entries' : 'translations'
    const body: Record<string, unknown> = mode.value === 'entries'
      ? { data: text, overwrite: overwrite.value }
      : { data: text, formatType: fmt.value, languageCode: importLang.value, overwrite: overwrite.value, autoCreate: autoCreate.value }
    const { data: res } = await client.post(`/projects/${encPathParam(projectSlug.value)}/imports/${endpoint}`, body, { timeout: 300000 })
    ElMessage.success(importSuccessMsg(res.data))
    importFile.value = null
  }
  catch (e: unknown) { showImportError(e) }
  finally { importing.value = false }
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

    <BaseForm :inline="true" class="import-bar" style="margin-top:0">
      <template v-if="mode === 'translate'">
        <BaseFormItem v-if="inputMode === 'text'" label="格式">
          <BaseSelect v-model="fmt" style="width:160px">
            <el-option class="base-option" label="JSON" :value="ImportFormat.JSON" />
            <el-option class="base-option" label="CSV" :value="ImportFormat.CSV" />
            <el-option class="base-option" label="Properties" :value="ImportFormat.Properties" />
            <el-option class="base-option" label="YAML" :value="ImportFormat.YAML" />
            <el-option class="base-option" label="XML" :value="ImportFormat.XML" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem v-if="needLang" label="语言">
          <BaseSelect v-model="importLang" style="width:160px">
            <el-option v-for="l in projectLanguages" :key="l.languageCode" class="base-option" :label="l.alias || l.languageCode" :value="l.languageCode" />
          </BaseSelect>
        </BaseFormItem>
        <BaseFormItem>
          <BaseCheckbox v-model="autoCreate">
            自动补全新条目
          </BaseCheckbox>
        </BaseFormItem>
      </template>
      <BaseFormItem>
        <BaseCheckbox v-model="overwrite">
          {{ mode === 'entries' ? '覆盖已有条目' : '覆盖已有译文' }}
        </BaseCheckbox>
      </BaseFormItem>
      <BaseFormItem>
        <BaseRadioGroup v-model="inputMode" button :options="[{ label: '文件', value: 'file' }, { label: '文本', value: 'text' }]" />
      </BaseFormItem>
      <BaseFormItem v-if="inputMode === 'file'">
        <el-upload :auto-upload="false" :show-file-list="false" :accept="fileAccept" @change="onFileChange">
          <BaseButton type="primary" :disabled="!perm.canManageContent.value">
            选择文件
          </BaseButton>
        </el-upload>
      </BaseFormItem>
      <BaseFormItem v-if="importFile && inputMode === 'file'">
        <BaseButton type="success" :loading="importing" :disabled="!perm.canManageContent.value" @click="doImport">
          开始导入
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
    <div v-if="importFile && inputMode === 'file'" style="font-size:13px;color:#909399;margin-bottom:12px">
      已选: {{ importFile.name }}
    </div>
    <div v-if="inputMode === 'text'" style="margin-bottom:16px">
      <BaseInput v-model="textInput" type="textarea" :rows="12" placeholder="在此粘贴或输入导入内容..." :disabled="!perm.canManageContent.value" style="font-family:monospace;font-size:13px" />
      <BaseButton type="success" :loading="importing" :disabled="!perm.canManageContent.value" style="margin-top:8px" @click="doTextImport">
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
