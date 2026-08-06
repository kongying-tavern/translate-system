import rawSpec from './swagger.json'

type JsonRecord = Record<string, unknown>

/** 各接口分组的描述（对应控制器 @Tags('X') 的标签名，供 OpenAPI 工具展示分组说明） */
export const TAG_DESCRIPTIONS: Record<string, string> = {
  Auth: '认证与用户管理：注册、登录、刷新令牌、当前用户信息、用户管理',
  Projects: '项目管理：项目 CRUD、项目语言、项目成员',
  Translations: '翻译管理：翻译键与译文列表、增删改、批量排序与导入、统计',
  Languages: '基础语言：语言代码列表与搜索',
  Imports: '批量导入：Key 与译文的批量导入',
  Exports: '导出与模板：导出格式模板 CRUD、导出预览与生成',
  Layouts: '布局模板与配置：模板/配置 CRUD 与最终配置合并',
  ApiKeys: 'API 密钥管理：当前用户的 API Key CRUD',
}

/** JWT Bearer 鉴权安全方案（tsoa 未生成 securitySchemes 定义，需补充以便工具识别鉴权） */
const SECURITY_SCHEMES = {
  auth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT Bearer 令牌：登录成功后从响应 data.accessToken 获取，请求头格式 Authorization: Bearer <token>',
  },
  admin: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT Bearer 令牌：需系统 admin 及以上角色的用户',
  },
} as const

/** 修正 tsoa 为 Record<> 生成的默认英文描述（无实际意义） */
const FIXED_SCHEMA_DESCRIPTIONS: Record<string, string> = {
  'Record_string.TranslationValue_': '各语言译文映射（键为语言代码，值为该语言译文记录）',
  'Record_string.unknown_': '任意 JSON 对象',
}

const spec = rawSpec as unknown as {
  openapi: string
  info: { title: string, version: string, contact?: unknown, description?: string }
  servers?: unknown
  paths: JsonRecord
  components: {
    securitySchemes?: JsonRecord
    schemas?: JsonRecord
  }
}

/** 按接口实际使用的标签生成顶层 tags 数组（tsoa 不生成，补充后工具可显示分组说明） */
export function buildTags(paths: JsonRecord): Array<{ name: string, description: string }> {
  const used = new Set<string>()
  for (const item of Object.values(paths)) {
    for (const method of Object.values(item as JsonRecord)) {
      const tags = (method as JsonRecord)?.tags
      if (Array.isArray(tags)) {
        for (const t of tags)
          used.add(String(t))
      }
    }
  }
  return [...used].map(name => ({
    name,
    description: TAG_DESCRIPTIONS[name] ?? '',
  }))
}

/** 修正 Record<> 生成 schema 的默认英文描述为中文说明 */
function fixSchemaDescriptions(schemas: JsonRecord): JsonRecord {
  const next: JsonRecord = { ...schemas }
  for (const [name, desc] of Object.entries(FIXED_SCHEMA_DESCRIPTIONS)) {
    const schema = next[name]
    if (schema && typeof schema === 'object')
      next[name] = { ...(schema as JsonRecord), description: desc }
  }
  return next
}

export const swaggerSpec = {
  ...spec,
  tags: buildTags(spec.paths),
  info: {
    ...spec.info,
    description: '翻译管理平台 API。业务统一响应 { code, message, data }，code 为 0 表示成功；鉴权失败返回 401（前端已接入自动刷新）。',
  },
  components: {
    ...spec.components,
    securitySchemes: {
      ...(spec.components.securitySchemes ?? {}),
      ...SECURITY_SCHEMES,
    },
    schemas: fixSchemaDescriptions(spec.components.schemas ?? {}),
  },
  basePath: '/api/v1',
}
