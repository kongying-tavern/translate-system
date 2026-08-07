import client from './client'

/** 拉取开放接口文档（OpenAPI，JWT 鉴权），返回原始 spec */
export async function getOpenApiSpec(): Promise<Record<string, unknown>> {
  const res = await client.get('/openapi-doc')
  return res.data as Record<string, unknown>
}
