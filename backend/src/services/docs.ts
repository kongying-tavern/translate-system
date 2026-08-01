import { swaggerSpec } from '../docs/swagger'
import { APIKEY_WHITELIST } from '../lib/apikey-whitelist'

type JsonRecord = Record<string, unknown>

const spec = swaggerSpec as unknown as {
  openapi?: string
  info?: unknown
  servers?: unknown
  paths?: JsonRecord
  components?: { securitySchemes?: unknown, schemas?: JsonRecord }
}

/** 收集对象中所有 `#/components/schemas/xxx` 的引用名 */
function collectSchemaRefs(value: unknown, acc: Set<string>): void {
  if (typeof value === 'string') {
    const prefix = '#/components/schemas/'
    if (value.startsWith(prefix))
      acc.add(value.slice(prefix.length))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value)
      collectSchemaRefs(item, acc)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value))
      collectSchemaRefs(v, acc)
  }
}

/**
 * 从完整 OpenAPI 中抽取 API Key 白名单对应的接口与相关 schema，
 * 供前端 API 文档页面展示（只暴露 `apikey/` 前缀部分）。
 */
export function getApiKeyOpenApi(): JsonRecord {
  const allPaths = spec.paths ?? {}
  const paths: JsonRecord = {}
  const refs = new Set<string>()

  for (const [pathKey, pathItem] of Object.entries(allPaths)) {
    const item = (pathItem ?? {}) as JsonRecord
    const matched: JsonRecord = {}
    for (const [method, operation] of Object.entries(item)) {
      if (operation && typeof operation === 'object') {
        const isWhitelisted = APIKEY_WHITELIST.some(
          w => w.method === method.toUpperCase() && w.path.test(pathKey),
        )
        if (isWhitelisted) {
          matched[method] = operation
          collectSchemaRefs(operation, refs)
        }
      }
    }
    if (Object.keys(matched).length)
      paths[pathKey] = matched
  }

  const allSchemas = spec.components?.schemas ?? {}
  const schemas: JsonRecord = {}
  // 闭包收集：操作直接引用的 schema + 其内部嵌套引用的 schema（如 ApiOk_* → data → 具体类型）
  const seen = new Set<string>()
  const queue = [...refs]
  while (queue.length) {
    const name = queue.shift()!
    if (seen.has(name))
      continue
    seen.add(name)
    const schema = allSchemas[name]
    if (!schema)
      continue
    schemas[name] = schema
    const nested = new Set<string>()
    collectSchemaRefs(schema, nested)
    for (const n of nested) {
      if (!seen.has(n))
        queue.push(n)
    }
  }

  return {
    openapi: spec.openapi,
    info: spec.info,
    servers: spec.servers,
    paths,
    components: {
      securitySchemes: spec.components?.securitySchemes,
      schemas,
    },
  }
}
