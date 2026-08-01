<script setup lang="ts">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { JsonSchema, JsonSchemaField } from '@/utils/jsonSchema'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import client from '@/api/client'
import { BaseInput, BasePageHeader, BaseTable } from '@/components/ui'
import { resolveSchemaRef, schemaToFields, typeLabel } from '@/utils/jsonSchema'

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
  bodyFields: JsonSchemaField[]
  responseFields: JsonSchemaField[]
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
const activeTab = ref('auth')
const activeEndpoint = ref<Record<string, string>>({})

function endpointKey(ep: Endpoint | undefined): string {
  return ep ? `${ep.method}-${ep.path}` : ''
}

function onEndpointTabChange(key: string, v: unknown): void {
  activeEndpoint.value[key] = v == null ? '' : String(v)
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
  const path = gen ? gen.path : '/api/v1/apikey/projects/项目ID/exports/generate'
  return `# 导出翻译
curl -X POST ${path} \\
  -H "x-api-key: ak_xxx" \\
  -H "x-api-secret: xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"templateSlug":"模板ID","languageCodes":["zh-Hans"]}'

# 获取项目翻译列表
curl http://localhost:3000/api/v1/apikey/projects/项目ID/translations \\
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

const fieldColumns: BaseTableColumnConfig<JsonSchemaField>[] = [
  { dataKey: 'name', title: '字段', width: 170 },
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
  const schemas = spec.components?.schemas ?? {}
  const list: Endpoint[] = []
  for (const [rawPath, item] of Object.entries(spec.paths)) {
    const apiKeyPath = rawPath.replace(/^\/api\/v1\//, '/api/v1/apikey/')
    for (const [method, op] of Object.entries(item)) {
      const summary = op.summary ?? ''
      const desc = op.description ?? op.summary ?? ''
      const bodySchema = op.requestBody?.content?.['application/json']?.schema
      const respSchemaRaw = op.responses?.['200']?.content?.['application/json']?.schema
      const dataSchema = respSchemaRaw ? resolveSchemaRef(respSchemaRaw, schemas).properties?.data : undefined
      list.push({
        method,
        path: apiKeyPath,
        label: endpointLabel(summary, desc, rawPath),
        summary: desc,
        group: groupOf(rawPath),
        paramRows: op.parameters ? toParamRows(op.parameters) : [],
        bodyFields: bodySchema ? schemaToFields(bodySchema, '', false, -1, schemas) : [],
        responseFields: dataSchema ? schemaToFields(dataSchema, 'data', false, 0, schemas) : [],
      })
    }
  }
  endpoints.value = list
}

onMounted(async () => {
  loading.value = true
  try {
    const { data: res } = await client.get<{ code: number, data: OpenApiSpec }>('/docs/openapi')
    parseOpenApi(res.data)
  }
  catch {
    ElMessage.error('加载 API 文档失败')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="api-doc-page">
    <BasePageHeader title="API 文档" />

    <el-tabs v-model="activeTab" tab-position="left" class="doc-tabs">
      <el-tab-pane label="鉴权与调用方式" name="auth">
        <div class="pane-body">
          <el-card shadow="never" class="auth-card">
            <p class="intro">
              通过 <code>x-api-key</code> + <code>x-api-secret</code> 请求头鉴权，在 API 路径前加 <code>/api/v1/apikey</code> 前缀代理访问白名单接口。
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
          <div v-loading="loading">
            <template v-if="g.items.length">
              <el-tabs
                class="endpoint-tabs"
                :model-value="activeEndpoint[g.key] ?? endpointKey(g.items[0])"
                @update:model-value="onEndpointTabChange(g.key, $event)"
              >
                <el-tab-pane v-for="ep in g.items" :key="`${ep.method}-${ep.path}`" :name="`${ep.method}-${ep.path}`" :label="ep.label">
                  <el-card class="endpoint-card" shadow="never">
                    <template #header>
                      <div class="endpoint-header">
                        <span class="method-badge" :style="{ background: methodColor[ep.method] }">{{ ep.method.toUpperCase() }}</span>
                        <code class="endpoint-path">{{ ep.path }}</code>
                      </div>
                    </template>
                    <p v-if="ep.summary" class="endpoint-summary">
                      {{ ep.summary }}
                    </p>
                    <template v-if="ep.paramRows.length">
                      <h5 class="section-title">
                        Path / Query 参数
                      </h5>
                      <BaseTable :data="ep.paramRows" :columns="paramColumns" stripe size="small" />
                    </template>
                    <template v-if="ep.bodyFields.length">
                      <h5 class="section-title">
                        请求体字段
                      </h5>
                      <BaseTable :data="ep.bodyFields" :columns="fieldColumns" stripe size="small" />
                    </template>
                    <template v-if="ep.responseFields.length">
                      <h5 class="section-title">
                        响应 data 字段
                      </h5>
                      <BaseTable :data="ep.responseFields" :columns="fieldColumns" stripe size="small" />
                    </template>
                  </el-card>
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

<style scoped>
.api-doc-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.api-doc-page :deep(.doc-tabs) {
  flex: 1;
  min-height: 0;
}

.api-doc-page :deep(.el-tabs__content) {
  overflow-y: auto;
}

/* 第二层横向 tab 固定在可视区顶部，不随内容滚动 */
.endpoint-tabs :deep(.el-tabs__header) {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fff;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
}

.endpoint-tabs {
  margin: 0;
}

.pane-body {
  padding: 0 8px 16px 12px;
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

.endpoint-card :deep(.el-card__header) {
  padding: 10px 16px;
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
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.endpoint-path {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.endpoint-summary {
  margin: 0 0 8px;
  color: #606266;
  font-size: 13px;
}

.section-title {
  margin: 12px 0 6px;
  font-size: 13px;
  color: #303133;
}
</style>
