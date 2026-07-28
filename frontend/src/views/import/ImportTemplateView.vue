<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { ProjectLanguage } from '@/types/models'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import { ImportFormat } from '@/data/importFormats'

const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const projectLanguages = ref<ProjectLanguage[]>([])
const mode = ref('entries')
const fmt = ref<string>('auto')
const importLang = ref('')
const overwrite = ref(false)
const autoCreate = ref(true)
const importing = ref(false)
const importFile = ref<File | null>(null)
const exampleTab = ref('json')
const inputMode = ref('file')
const textInput = ref('')

const needLang = computed(() => mode.value === 'translate' && (fmt.value === 'auto' || fmt.value === ImportFormat.JSON || fmt.value === ImportFormat.Properties))
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

const fmtNames: Record<string, string> = { auto: '自动检测', [ImportFormat.JSON]: 'JSON', [ImportFormat.CSV]: 'CSV', [ImportFormat.Properties]: 'Properties', [ImportFormat.YAML]: 'YAML', [ImportFormat.XML]: 'XML' }
const exampleTitle = computed(() => fmtNames[fmt.value] || fmt.value)

const entriesExample = {
  json: '{\n  "login.title": { "sourceText": "登录遇到问题？", "tags": ["auth", "ui"], "context": "登录弹窗标题" },\n  "error.network": { "tags": ["network"] }\n}',
  csv: 'key,sourceText,tags,context\nlogin.title,登录遇到问题？,auth;ui,登录弹窗标题\nerror.network,,network,',
  yaml: 'login.title:\n  sourceText: 登录遇到问题？\n  tags: [auth, ui]\n  context: 登录弹窗标题\nerror.network:\n  tags: [network]',
  xml: '<resources>\n  <string name="login.title" sourceText="登录遇到问题？" tags="auth;ui" context="登录弹窗标题" />\n  <string name="error.network" tags="network" />\n</resources>',
}

const exampleText = computed(() => {
  switch (fmt.value) {
    case 'auto': return '根据文件内容自动识别格式\n支持: JSON / CSV / YAML / XML'
    case ImportFormat.JSON: return '{\n  "zh-Hans": { "login.title": "登录" },\n  "en-US": { "login.title": "Login" }\n}'
    case ImportFormat.CSV: return 'key,sourceText,zh-Hans,en-US\nlogin.title,登录,登录,Login'
    case ImportFormat.Properties: return 'login.title=Login\nerror.network=Network Error'
    case ImportFormat.YAML: return 'zh-Hans:\n  login.title: 登录\nen-US:\n  login.title: Login'
    case ImportFormat.XML: return '<resources>\n  <language code="zh-Hans">\n    <string name="login.title">登录</string>\n  </language>\n  <language code="en-US">\n    <string name="login.title">Login</string>\n  </language>\n</resources>'
    default: return ''
  }
})

onMounted(async () => {
  const { data: res } = await client.get(`/projects/${projectSlug.value}/languages`)
  projectLanguages.value = res.data || []
  if (projectLanguages.value.length)
    importLang.value = projectLanguages.value[0].languageCode
})

function onFileChange(file: UploadFile) {
  importFile.value = file.raw ?? null
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
    const { data: res } = await client.post(`/projects/${projectSlug.value}/imports/${endpoint}`, body)
    const d1 = res.data
    ElMessage.success(`导入完成: ${d1.imported} 条${d1.created ? `，${d1.created} 新增` : ''}${d1.skipped ? `，${d1.skipped} 跳过（已有）` : ''}`)
    textInput.value = ''
  }
  catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '导入失败') }
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
    const { data: res } = await client.post(`/projects/${projectSlug.value}/imports/${endpoint}`, body)
    const d1 = res.data
    ElMessage.success(`导入完成: ${d1.imported} 条${d1.created ? `，${d1.created} 新增` : ''}${d1.skipped ? `，${d1.skipped} 跳过（已有）` : ''}`)
    importFile.value = null
  }
  catch (e: unknown) { ElMessage.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || '导入失败') }
  finally { importing.value = false }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>导入</h2>
    </div>

    <el-form :inline="true" class="import-bar">
      <el-form-item label="模式">
        <el-radio-group v-model="mode">
          <el-radio-button value="entries">
            导入条目
          </el-radio-button>
          <el-radio-button value="translate">
            导入翻译
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <el-form :inline="true" class="import-bar" style="margin-top:0">
      <template v-if="mode === 'translate'">
        <el-form-item label="格式">
          <el-select v-model="fmt" style="width:160px">
            <el-option label="自动检测" value="auto" />
            <el-option label="JSON" :value="ImportFormat.JSON" />
            <el-option label="CSV" :value="ImportFormat.CSV" />
            <el-option label="Properties" :value="ImportFormat.Properties" />
            <el-option label="YAML" :value="ImportFormat.YAML" />
            <el-option label="XML" :value="ImportFormat.XML" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="needLang" label="语言">
          <el-select v-model="importLang" style="width:160px">
            <el-option v-for="l in projectLanguages" :key="l.languageCode" :label="l.alias || l.languageCode" :value="l.languageCode" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="autoCreate">
            自动补全新条目
          </el-checkbox>
        </el-form-item>
      </template>
      <el-form-item>
        <el-checkbox v-model="overwrite">
          {{ mode === 'entries' ? '覆盖已有条目' : '覆盖已有译文' }}
        </el-checkbox>
      </el-form-item>
      <el-form-item>
        <el-radio-group v-model="inputMode" size="small">
          <el-radio-button value="file">
            文件
          </el-radio-button>
          <el-radio-button value="text">
            文本
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="inputMode === 'file'">
        <el-upload :auto-upload="false" :show-file-list="false" :accept="fileAccept" @change="onFileChange">
          <el-button type="primary">
            选择文件
          </el-button>
        </el-upload>
      </el-form-item>
      <el-form-item v-if="importFile && inputMode === 'file'">
        <el-button type="success" :loading="importing" @click="doImport">
          开始导入
        </el-button>
      </el-form-item>
    </el-form>
    <div v-if="importFile && inputMode === 'file'" style="font-size:13px;color:#909399;margin-bottom:12px">
      已选: {{ importFile.name }}
    </div>
    <div v-if="inputMode === 'text'" style="margin-bottom:16px">
      <el-input v-model="textInput" type="textarea" :rows="12" placeholder="在此粘贴或输入导入内容..." style="font-family:monospace;font-size:13px" />
      <el-button type="success" :loading="importing" style="margin-top:8px" @click="doTextImport">
        开始导入
      </el-button>
    </div>
    <el-alert v-if="mode === 'entries'" type="info" :closable="false" style="margin-bottom:16px" title="导入条目不会更改现有条目的翻译内容" />

    <el-card header="格式说明" style="margin-top:16px">
      <template v-if="mode === 'entries'">
        <p style="margin:0 0 12px;font-size:13px;color:#909399">
          字段: key(必填) / sourceText(原文) / tags(标签;分隔) / context(备注)
        </p>
        <el-tabs v-model="exampleTab" type="card" size="small">
          <el-tab-pane label="JSON" name="json">
            <pre class="ex-pre">{{ entriesExample.json }}</pre>
          </el-tab-pane>
          <el-tab-pane label="CSV" name="csv">
            <pre class="ex-pre">{{ entriesExample.csv }}</pre>
          </el-tab-pane>
          <el-tab-pane label="YAML" name="yaml">
            <pre class="ex-pre">{{ entriesExample.yaml }}</pre>
          </el-tab-pane>
          <el-tab-pane label="XML" name="xml">
            <pre class="ex-pre">{{ entriesExample.xml }}</pre>
          </el-tab-pane>
        </el-tabs>
      </template>
      <template v-else>
        <p style="margin:0 0 8px;font-size:13px;color:#909399">
          {{ exampleTitle }}
        </p>
        <pre class="ex-pre">{{ exampleText }}</pre>
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 20px; } .page-header h2 { margin: 0; }
.import-bar { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.import-bar .el-form-item { margin-bottom: 0; }
.ex-pre { font-size:13px; white-space:pre-wrap; margin:0; }
</style>
