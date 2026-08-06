import { ROLE_LEVEL, SystemRole } from '../constants/roles'
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

/** 闭包收集 schema：操作直接引用的 schema + 其内部嵌套引用（如 ApiOk_* → data → 具体类型） */
function resolveSchemas(refs: Set<string>): JsonRecord {
  const allSchemas = spec.components?.schemas ?? {}
  const schemas: JsonRecord = {}
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
  return schemas
}

/** API Key 鉴权安全方案（外部自动化通过请求头访问） */
const APIKEY_SECURITY_SCHEMES = {
  ApiKeyAuth: {
    type: 'apiKey',
    in: 'header',
    name: 'x-api-key',
    description: 'API Key，格式 ak_xxxx，在右上角菜单 → API 密钥 中生成',
  },
  ApiKeySecret: {
    type: 'apiKey',
    in: 'header',
    name: 'x-api-secret',
    description: 'API Secret，生成密钥时一次性返回，需妥善保管',
  },
} as const

/** 判断方法 + 路径是否命中 API Key 白名单 */
function isWhitelisted(method: string, pathKey: string): boolean {
  return APIKEY_WHITELIST.some(
    w => w.method === method.toUpperCase() && w.path.test(pathKey),
  )
}

/** 组装 OpenAPI：保留 openapi/info/servers，按给定 paths 重写 components.schemas */
function buildOpenApi(paths: JsonRecord, securitySchemes?: JsonRecord, titleSuffix?: string): JsonRecord {
  const refs = new Set<string>()
  for (const item of Object.values(paths)) {
    for (const op of Object.values(item as JsonRecord))
      collectSchemaRefs(op, refs)
  }
  const info = (spec.info && typeof spec.info === 'object')
    ? { ...(spec.info as JsonRecord), title: `${((spec.info as JsonRecord).title ?? '')}${titleSuffix ?? ''}` }
    : spec.info
  return {
    openapi: spec.openapi,
    info,
    servers: spec.servers,
    paths,
    components: {
      securitySchemes: securitySchemes ?? spec.components?.securitySchemes,
      schemas: resolveSchemas(refs),
    },
  }
}

/** 抽取白名单接口：路径加 `/apikey` 前缀，operation 改用 apiKey 鉴权；userRole 传入时按系统角色过滤 */
function buildApiKeyPaths(userRole?: string): JsonRecord {
  const allPaths = spec.paths ?? {}
  const paths: JsonRecord = {}
  for (const [pathKey, pathItem] of Object.entries(allPaths)) {
    const item = (pathItem ?? {}) as JsonRecord
    const matched: JsonRecord = {}
    for (const [method, operation] of Object.entries(item)) {
      if (!operation || typeof operation !== 'object')
        continue
      if (!isWhitelisted(method, pathKey))
        continue
      if (userRole !== undefined && !canAccessOpenApi(userRole, pathKey))
        continue
      matched[method] = {
        ...(operation as JsonRecord),
        security: [{ ApiKeyAuth: [], ApiKeySecret: [] }],
      }
    }
    if (Object.keys(matched).length)
      paths[`/apikey${pathKey}`] = matched
  }
  return paths
}

/**
 * 开放接口按业务功能所需的最小系统角色分层：
 * - 默认（读接口 + 导出预览/生成）任意项目成员可用，最小系统角色 user
 * - 批量导入（业务上需项目 Maintainer+）最小系统角色 admin
 */
const APIKEY_ROLE_RULES: Array<{ path: RegExp, minRole: string }> = [
  { path: /^\/projects\/[^/]+\/imports\/(entries|translations)$/, minRole: SystemRole.Admin },
]

/** 判断用户系统角色是否满足开放接口的最小角色要求 */
function canAccessOpenApi(userRole: string | undefined, path: string): boolean {
  const current = userRole ? (ROLE_LEVEL[userRole] ?? 0) : 0
  for (const rule of APIKEY_ROLE_RULES) {
    if (rule.path.test(path))
      return current >= (ROLE_LEVEL[rule.minRole] ?? 0)
  }
  return current >= (ROLE_LEVEL[SystemRole.User] ?? 0)
}

/**
 * 抽取 API Key 白名单对应的接口（`/apikey` 前缀路径 + apiKey 鉴权）与相关 schema，
 * 供前端「开放接口说明」页展示，并按登录用户系统角色过滤可见接口。
 */
export function getApiKeyOpenApi(userRole?: string): JsonRecord {
  return buildOpenApi(buildApiKeyPaths(userRole), APIKEY_SECURITY_SCHEMES)
}

/**
 * 完整 API Key OpenAPI（不按角色过滤），供 Swagger UI `/api-docs/apikey.json` 使用。
 */
export function buildApiKeyOpenApiSpec(): JsonRecord {
  return buildOpenApi(buildApiKeyPaths(), APIKEY_SECURITY_SCHEMES, ' · API Key 开放接口')
}
