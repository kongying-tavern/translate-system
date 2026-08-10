import type { ApiOk, ApiPage } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import type { BatchUpsertItem } from '../services/translation'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Put, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok, okPage } from '../lib/api'
import { prisma } from '../lib/prisma'
import { decodePathParams } from '../middleware/decodePathParams'
import * as transService from '../services/translation'

export interface TranslationValue {
  /** 译文记录ID */
  id: string
  /** 已翻译文本 */
  translatedText: string
  /** 是否已审核 */
  isReviewed: boolean
  /** 审核备注（可空） */
  reviewerComment: string | null
}

export interface GroupedRow {
  /** 行序号 */
  rowIndex: number
  /** 排序值 */
  sortOrder: number
  /** 翻译键名 */
  translationKey: string
  /** 原文文本 */
  sourceText: string
  /** 备注上下文 */
  context: string
  /** 标签列表 */
  tags: string[]
  /** 键ID */
  keyId: string
  /** 各语言译文（键为语言代码） */
  translations: Record<string, TranslationValue>
}

export interface TranslationCount {
  /** 总条数 */
  total: number
  /** 已翻译条数 */
  translated: number
  /** 语言代码 */
  languageCode: string
}

export interface CreateTranslationBody {
  /**
   * 翻译键名（项目内唯一）
   * @example "login.title"
   */
  translationKey: string
  /**
   * 原文文本（可空，为空则新建后不写入源语言）
   * @example "登录"
   */
  sourceText?: string
  /**
   * 备注上下文（可空）
   * @example "登录页面标题"
   */
  context?: string
  /**
   * 标签列表（可空）
   * @example ["auth", "login"]
   */
  tags?: string[]
}

export interface UpdateKeyBody {
  /** 新的翻译键名（可空） */
  translationKey?: string
  /** 原文文本（可空） */
  sourceText?: string
  /** 标签列表（可空） */
  tags?: string[]
  /** 备注上下文（可空） */
  context?: string
}

export interface SaveForLangBody {
  /** 已翻译文本 */
  translatedText: string
}

export interface SortOrderItem {
  /** 键ID */
  keyId: string
  /** 排序值 */
  sortOrder: number
}

export interface SortOrdersBody {
  /** 排序项列表 */
  orders: SortOrderItem[]
}

export interface BatchBody {
  /** 批量导入的翻译项 */
  translations: BatchUpsertItem[]
}

@Route('projects')
@Tags('Translations')
@Middlewares(decodePathParams)
export class TranslationsController extends Controller {
  /**
   * 分组翻译列表（每 key 一行，内嵌各语言译文）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param page 页码
   * @param pageSize 每页条数，传 -1 返回全部数据
   * @param languageCode 语言代码
   * @param search 搜索关键词
   * @param tags 标签列表
   * @param untransOnly 仅未翻译
   * @summary 分组翻译列表
   */
  @Get('{projectSlug}/translations')
  @Security('auth')
  public async listGrouped(
    @Request() req: AuthRequest,
    @Path('projectSlug') projectSlug: string,
    @Query() page?: string,
    @Query() pageSize?: string,
    @Query() languageCode?: string,
    @Query() search?: string,
    @Query() tags?: string,
    @Query() untransOnly?: string,
  ): Promise<ApiOk<ApiPage<GroupedRow>>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const p = Math.max(1, parseInt(page || '1'))
    const raw = parseInt(pageSize || '20')
    const all = raw === -1
    const size = all ? 1e9 : Math.min(100, raw)
    const result = await transService.listGrouped(access.projectId, {
      languageCode,
      search,
      tags: tags ? tags.split(',') : undefined,
      untransOnly: untransOnly === 'true',
      page: p,
      pageSize: size,
    })
    return okPage(result.list as GroupedRow[], result.total, p, all ? result.total : size)
  }

  /**
   * 新增 key
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 新增 key
   */
  @Post('{projectSlug}/translations')
  @Security('auth')
  public async create(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: CreateTranslationBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await transService.createTranslation(access.projectId, body))
  }

  /**
   * 统计某语言维度下已翻译/总数
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param languageCode 语言代码
   * @param tags 标签列表
   * @summary 翻译数量统计
   */
  @Get('{projectSlug}/translations/count')
  @Security('auth')
  public async count(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Query() languageCode?: string, @Query() tags?: string): Promise<ApiOk<TranslationCount>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.getTranslationCount(projectSlug, languageCode, tags ? tags.split(',') : undefined))
  }

  /**
   * 项目全部标签列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 标签列表
   */
  @Get('{projectSlug}/translations/tags/list')
  @Security('auth')
  public async tagsList(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<string[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.getAllTags(access.projectId))
  }

  /**
   * 删除 key
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param translationId 翻译记录ID
   * @summary 删除 key
   */
  @Delete('{projectSlug}/translations/{translationId}')
  @Security('auth')
  public async remove(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() translationId: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await transService.deleteTranslation(translationId)
    return ok(null)
  }

  /**
   * 批量保存排序
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 批量保存排序
   */
  @Put('{projectSlug}/translations/sortOrders')
  @Security('auth')
  public async updateSortOrders(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: SortOrdersBody): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    for (const o of body.orders)
      await prisma.translationKey.update({ where: { id: o.keyId }, data: { sortOrder: o.sortOrder } })
    return ok(null)
  }

  /**
   * 批量导入译文
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 批量导入译文
   */
  @Post('{projectSlug}/translations/batch')
  @Security('auth')
  public async batch(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: BatchBody): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await transService.batchUpsert(access.projectId, body.translations)
    return ok(null)
  }

  /**
   * 更新 key 级属性（keyId 定位）：Key 名 / 原文 / 标签 / 备注
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param keyId 翻译键 ID
   * @param body 请求体
   * @summary 更新 key 级属性
   */
  @Put('{projectSlug}/translations/{keyId}')
  @Security('auth')
  public async updateKey(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() keyId: string, @Body() body: UpdateKeyBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await transService.updateKeyByKeyId(access.projectId, keyId, body))
  }

  /**
   * 保存指定语言的译文（keyId 定位）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param keyId 翻译键 ID
   * @param langCode 语言代码
   * @param body 请求体
   * @summary 保存指定语言译文
   */
  @Put('{projectSlug}/translations/{keyId}/{langCode}')
  @Security('auth')
  public async saveForLang(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() keyId: string, @Path() langCode: string, @Body() body: SaveForLangBody): Promise<ApiOk<unknown>> {
    // 译文列任意成员可编辑；service 层校验目标语言为项目语言且非源语言
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.saveValueForLang(access.projectId, keyId, langCode, body.translatedText))
  }
}
