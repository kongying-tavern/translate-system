import { Controller, Get, Route, Security, Tags } from '@tsoa/runtime'
import { buildApiKeyOpenApiSpec } from '../services/docs'

/**
 * 开放接口文档（OpenAPI），登录后可查看。
 * 内容与公开的 apikey.json 一致（复用 buildApiKeyOpenApiSpec 派生逻辑），
 * 但走 JWT 鉴权，供前端「开放接口说明」页使用，不依赖 /openapi/* 代理。
 */
@Route('openapi-doc')
@Tags('ApiKeys')
export class OpenApiController extends Controller {
  /**
   * 开放接口文档（OpenAPI）
   * @summary 开放接口文档
   */
  @Get()
  @Security('auth')
  public async getOpenApiDoc(): Promise<Record<string, unknown>> {
    return buildApiKeyOpenApiSpec()
  }
}
