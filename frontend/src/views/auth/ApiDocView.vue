<script setup lang="ts">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { JsonSchema } from '@/utils/jsonSchema'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { getOpenApiSpec } from '@/api/openapi'
import { BaseInput, BaseJsonSchemaViewer, BasePageHeader, BaseTable } from '@/components/ui'
import { dereferenceSchema, resolveSchemaRef, typeLabel } from '@/utils/jsonSchema'

interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  description?: string
  schema?: JsonSchema
}

interface OpenApiOperation {
  operationId?: string
  tags?: string[]
  summary?: string
  description?: string
  parameters?: OpenApiParameter[]
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> }
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>
}

interface OpenApiSpec {
  openapi?: string
  paths: Record<string, Record<string, OpenApiOperation>>
  servers?: Array<{ url?: string }>
  components?: { schemas?: Record<string, JsonSchema> }
}

interface ParamRow {
  name: string
  in: string
  type: string
  required: boolean
  desc: string
}

interface Endpoint {
  method: string
  path: string
  label: string
  summary: string
  group: string
  paramRows: ParamRow[]
  bodySchema?: JsonSchema
  responseSchema?: JsonSchema
}

interface EndpointGroup {
  key: string
  label: string
  items: Endpoint[]
}

const GROUP_DEFS = [
  { key: 'translations', label: '翻译查询', test: (p: string) => p.includes('/translations') },
  { key: 'languages', label: '语言管理', test: (p: string) => p.includes('/languages') },
  { key: 'imports', label: '导入', test: (p: string) => p.includes('/imports') },
  { key: 'exports', label: '导出', test: (p: string) => p.includes('/exports') },
  { key: 'other', label: '其他', test: () => true },
]

function groupOf(path: string): string {
  return GROUP_DEFS.find(g => g.test(path))!.key
}

/** 横向二级标题：优先取 OpenAPI summary（后端 @summary 短名），未命中时取描述括号前部分，再回退路径末段 */
function endpointLabel(summary: string, description: string, path: string): string {
  const name = summary || description.trim().split('（')[0] || ''
  if (name)
    return name.length > 12 ? `${name.slice(0, 12)}…` : name
  const segs = path.split('/').filter(s => s && !s.startsWith('{'))
  return segs[segs.length - 1] ?? ''
}

const methodColor: Record<string, string> = {
  get: '#409eff',
  post: '#67c23a',
  put: '#e6a23c',
  delete: '#f56c6c',
}

const loading = ref(false)
const endpoints = ref<Endpoint[]>([])
const apiBase = ref('')
const activeTab = ref('auth')
const activeEndpoint = ref<Record<string, string>>({})

function endpointKey(ep: Endpoint | undefined): string {
  return ep ? `${ep.method}-${ep.path}` : ''
}

function onEndpointTabChange(key: string, v: unknown): void {
  activeEndpoint.value[key] = v == null ? '' : String(v)
}

const detailTab = ref<Record<string, string>>({})

/** 接口详情子标签：按需返回非空的三个区块 */
function detailTabs(ep: Endpoint): { name: string, label: string }[] {
  const tabs: { name: string, label: string }[] = []
  if (ep.paramRows.length)
    tabs.push({ name: 'params', label: 'Path / Query 参数' })
  if (ep.bodySchema)
    tabs.push({ name: 'body', label: '请求体字段' })
  if (ep.responseSchema)
    tabs.push({ name: 'response', label: '响应 data 字段' })
  return tabs
}

function onDetailTabChange(key: string, v: unknown): void {
  detailTab.value[key] = v == null ? '' : String(v)
}

const groups = computed<EndpointGroup[]>(() => {
  const order: string[] = []
  const map = new Map<string, Endpoint[]>()
  for (const ep of endpoints.value) {
    if (!map.has(ep.group)) {
      map.set(ep.group, [])
      order.push(ep.group)
    }
    map.get(ep.group)!.push(ep)
  }
  return order.map(key => ({ key, label: GROUP_DEFS.find(g => g.key === key)?.label ?? key, items: map.get(key)! }))
})

const headerRows = [
  { name: 'x-api-key', desc: 'API Key，格式 ak_xxxx，在右上角菜单 → API 密钥 中生成' },
  { name: 'x-api-secret', desc: 'API Secret，生成密钥时一次性返回，需要妥善保管' },
  { name: 'Content-Type', desc: 'application/json' },
]

const curlExample = computed(() => {
  const gen = endpoints.value.find(e => e.method === 'post' && e.path.includes('/exports/generate'))
  const base = `http://localhost:3000${apiBase.value}`
  const path = gen ? `${base}${gen.path}` : `${base}/apikey/projects/项目ID/exports/generate`
  return `# 导出翻译
curl -X POST ${path} \\
  -H "x-api-key: ak_xxx" \\
  -H "x-api-secret: xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"templateSlug":"模板ID","languageCodes":["zh-Hans"]}'

# 获取项目翻译列表
curl ${base}/apikey/projects/项目ID/translations \\
  -H "x-api-key: ak_xxx" -H "x-api-secret: xxx"

# 响应格式: { "code": 0, "data": {...} }`
})

const headerColumns: BaseTableColumnConfig[] = [
  { dataKey: 'name', title: '参数', width: 180 },
  { dataKey: 'desc', title: '说明' },
]

const paramColumns: BaseTableColumnConfig<ParamRow>[] = [
  { dataKey: 'name', title: '参数', width: 170 },
  { dataKey: 'in', title: '位置', width: 80 },
  { dataKey: 'type', title: '类型', width: 110 },
  { dataKey: 'required', title: '必填', width: 60, cell: row => (row.required ? '是' : '否') },
  { dataKey: 'desc', title: '说明' },
]

function toParamRows(params: OpenApiParameter[]): ParamRow[] {
  const inLabel: Record<string, string> = { path: '路径', query: '查询', header: '请求头' }
  return params.map(p => ({
    name: p.name,
    in: inLabel[p.in] ?? p.in,
    type: p.schema ? typeLabel(p.schema) : 'string',
    required: !!p.required,
    desc: p.description ?? '',
  }))
}

function parseOpenApi(spec: OpenApiSpec) {
  apiBase.value = (spec.servers?.[0]?.url ?? '').replace(/\/$/, '')
  const schemas = spec.components?.schemas ?? {}
  const list: Endpoint[] = []
  for (const [rawPath, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      const summary = op.summary ?? ''
      const desc = op.description ?? op.summary ?? ''
      const bodySchemaRaw = op.requestBody?.content?.['application/json']?.schema
      const respSchemaRaw = op.responses?.['200']?.content?.['application/json']?.schema
      const dataProp = respSchemaRaw ? resolveSchemaRef(respSchemaRaw, schemas).properties?.data : undefined
      list.push({
        method,
        path: rawPath,
        label: endpointLabel(summary, desc, rawPath),
        summary: desc,
        group: groupOf(rawPath),
        paramRows: op.parameters ? toParamRows(op.parameters) : [],
        bodySchema: bodySchemaRaw ? dereferenceSchema(bodySchemaRaw, schemas) : undefined,
        responseSchema: dataProp ? dereferenceSchema(dataProp, schemas) : undefined,
      })
    }
  }
  endpoints.value = list
}

onMounted(async () => {
  loading.value = true
  try {
    parseOpenApi(await getOpenApiSpec() as unknown as OpenApiSpec)
  }
  catch {
    ElMessage.error('加载开放接口说明失败')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="api-doc-page">
    <BasePageHeader title="开放接口说明" />

    <el-tabs v-model="activeTab" tab-position="left" class="doc-tabs">
      <el-tab-pane label="鉴权与调用方式" name="auth">
        <div class="pane-body">
          <el-card shadow="never" class="auth-card">
            <p class="intro">
              以下为<strong>供外部方调用</strong>的开放接口（均加入白名单）。通过 <code>x-api-key</code> + <code>x-api-secret</code> 请求头鉴权，路径以 <code>/apikey</code> 开头，完整 URL 为 <code>服务器地址/api/v1</code> + 以下路径。
            </p>
            <h4 class="section-title">
              请求头
            </h4>
            <BaseTable :data="headerRows" :columns="headerColumns" stripe size="small" />
            <h4 class="section-title">
              curl 示例
            </h4>
            <BaseInput :model-value="curlExample" type="textarea" :rows="6" readonly class="curl-box" />
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane v-for="g in groups" :key="g.key" :label="g.label" :name="g.key">
        <div class="pane-body">
          <div v-loading="loading" class="group-wrap">
            <template v-if="g.items.length">
              <el-tabs
                class="endpoint-tabs"
                lazy
                :model-value="activeEndpoint[g.key] ?? endpointKey(g.items[0])"
                @update:model-value="onEndpointTabChange(g.key, $event)"
              >
                <el-tab-pane v-for="ep in g.items" :key="`${ep.method}-${ep.path}`" :name="`${ep.method}-${ep.path}`" :label="ep.label">
                  <div class="endpoint-panel">
                    <div class="endpoint-head">
                      <div class="endpoint-header">
                        <span class="method-badge" :style="{ background: methodColor[ep.method] }">{{ ep.method.toUpperCase() }}</span>
                        <code class="endpoint-path">{{ ep.path }}</code>
                      </div>
                      <p v-if="ep.summary" class="endpoint-summary">
                        {{ ep.summary }}
                      </p>
                    </div>
                    <div class="endpoint-detail">
                      <el-tabs
                        class="detail-tabs"
                        lazy
                        :model-value="detailTab[endpointKey(ep)] ?? detailTabs(ep)[0]?.name"
                        @update:model-value="onDetailTabChange(endpointKey(ep), $event)"
                      >
                        <el-tab-pane v-for="t in detailTabs(ep)" :key="t.name" :name="t.name" :label="t.label">
                          <BaseTable
                            v-if="t.name === 'params'"
                            :data="ep.paramRows"
                            :columns="paramColumns"
                            stripe
                            size="small"
                          />
                          <BaseJsonSchemaViewer
                            v-else-if="t.name === 'body'"
                            :schema="ep.bodySchema ?? {}"
                          />
                          <BaseJsonSchemaViewer
                            v-else-if="t.name === 'response'"
                            :schema="ep.responseSchema ?? {}"
                          />
                        </el-tab-pane>
                      </el-tabs>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </template>
            <el-empty v-else-if="!loading" description="暂无可用 API" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.api-doc-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.api-doc-page :deep(.doc-tabs) {
  flex: 1;
  min-height: 0;
}

.api-doc-page :deep(.doc-tabs .el-tabs__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.api-doc-page :deep(.doc-tabs .el-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 接口选择横向 tab：header 固定，内容区占满剩余高度 */
.endpoint-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
}

.endpoint-tabs :deep(.el-tabs__item),
.detail-tabs :deep(.el-tabs__item) {
  font-size: 13px;
}

.endpoint-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.endpoint-tabs :deep(.el-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pane-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 8px 0 12px;
  overflow-y: auto;
}

.group-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 接口详情：上部方法+路径+描述固定，下部子标签区滚动 */
.endpoint-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.endpoint-head {
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
}

.endpoint-detail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 16px;
}

.detail-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
}

.detail-tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
}

.detail-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.detail-tabs :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-tabs :deep(.base-json-schema-viewer) {
  flex: 1;
  min-height: 0;
}

.auth-card {
  width: 100%;
}

.intro {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
}

.intro code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  color: #e74c3c;
}

.curl-box :deep(textarea) {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  background: #f8f9fa;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.method-badge {
  flex-shrink: 0;
  min-width: 52px;
  text-align: center;
  padding: 3px 10px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
}

.endpoint-path {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
  overflow-wrap: anywhere;
}

.endpoint-summary {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.section-title {
  margin: 12px 0 6px;
  font-size: 13px;
  color: #303133;
}
</style>
