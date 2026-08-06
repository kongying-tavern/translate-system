import type { ApiOk } from '../lib/api'
import { Controller, Get, Queries, Route, Security, Tags } from '@tsoa/runtime'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import * as langService from '../services/language'
import { AppError } from '../utils/AppError'

export interface SearchQuery {
  /** 搜索关键词 */
  q: string
}

@Route('languages')
@Tags('Languages')
export class LanguagesController extends Controller {
  /**
   * 基础语言列表
   * @summary 基础语言列表
   */
  @Get()
  @Security('auth')
  public async listBaseLanguages(): Promise<ApiOk<unknown[]>> {
    return ok(await langService.getBaseLanguages())
  }

  /**
   * 搜索基础语言
   * @param q 搜索查询
   * @summary 搜索基础语言
   */
  @Get('search')
  @Security('auth')
  public async search(@Queries() q: SearchQuery): Promise<ApiOk<unknown[]>> {
    if (!q.q)
      throw new AppError(ErrCode.InvalidParams, 'query q is required')
    return ok(await langService.searchBaseLanguages(q.q))
  }
}
