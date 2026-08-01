import type { ApiOk, ApiPage } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import type { BatchUpsertItem } from '../services/translation'
import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok, okPage } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import * as transService from '../services/translation'
import { AppError } from '../utils/AppError'

export interface TranslationValue {
  id: string
  translatedText: string
  isReviewed: boolean
  reviewerComment: string | null
}

export interface GroupedRow {
  rowIndex: number
  sortOrder: number
  translationKey: string
  sourceText: string
  context: string
  tags: string[]
  keyId: string
  translations: Record<string, TranslationValue>
}

export interface TranslationCount {
  total: number
  translated: number
  languageCode: string
}

export interface CreateTranslationBody {
  translationKey: string
  languageCode: string
  sourceText: string
  translatedText?: string
  context?: string
  tags?: string[]
}

export interface UpdateKeyBody {
  translationKey: string
  sourceText?: string
}

export interface SaveForLangBody {
  translatedText?: string
  tags?: string[]
  context?: string
}

export interface SortOrderItem {
  keyId: string
  sortOrder: number
}

export interface SortOrdersBody {
  orders: SortOrderItem[]
}

export interface BatchBody {
  translations: BatchUpsertItem[]
}

@Route('projects')
@Tags('Translations')
export class TranslationsController extends Controller {
  /**
   * 分组翻译列表（每 key 一行，内嵌各语言译文）
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
    const size = Math.min(100, parseInt(pageSize || '20'))
    const result = await transService.listGrouped(access.projectId, {
      languageCode,
      search,
      tags: tags ? tags.split(',') : undefined,
      untransOnly: untransOnly === 'true',
      page: p,
      pageSize: size,
    })
    return okPage(result.list as GroupedRow[], result.total, p, size)
  }

  /** 新增 key */
  @Post('{projectSlug}/translations')
  @Security('auth')
  public async create(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: CreateTranslationBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await transService.createTranslation(access.projectId, body))
  }

  /** 更新 key 与原文（必须在 translations/{key}/{langCode} 之前） */
  @Put('{projectSlug}/translations/key/{oldKey}')
  @Security('auth')
  public async updateKey(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() oldKey: string, @Body() body: UpdateKeyBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.translationKey?.trim())
      throw new AppError(ErrCode.InvalidParams, 'Key cannot be empty')
    return ok(await transService.updateKeyAndSource(access.projectId, oldKey, body.translationKey.trim(), body.sourceText))
  }

  /**
   * 统计某语言维度下已翻译/总数
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
   * @summary 标签列表
   */
  @Get('{projectSlug}/translations/tags/list')
  @Security('auth')
  public async tagsList(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<string[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.getAllTags(access.projectId))
  }

  /** 删除 key */
  @Delete('{projectSlug}/translations/{translationId}')
  @Security('auth')
  public async remove(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() translationId: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await transService.deleteTranslation(translationId)
    return ok(null)
  }

  /** 批量保存排序 */
  @Put('{projectSlug}/translations/sortOrders')
  @Security('auth')
  public async updateSortOrders(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: SortOrdersBody): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    for (const o of body.orders)
      await prisma.translationKey.update({ where: { id: o.keyId }, data: { sortOrder: o.sortOrder } })
    return ok(null)
  }

  /** 批量导入译文 */
  @Post('{projectSlug}/translations/batch')
  @Security('auth')
  public async batch(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: BatchBody): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await transService.batchUpsert(access.projectId, body.translations)
    return ok(null)
  }

  /** 保存 key 级属性（context/tags，无语言维度） */
  @Put('{projectSlug}/translations/{key}')
  @Security('auth')
  public async saveForKey(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() key: string, @Body() body: SaveForLangBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.saveForLang(access.projectId, key, '', body))
  }

  /** 保存指定语言的译文 */
  @Put('{projectSlug}/translations/{key}/{langCode}')
  @Security('auth')
  public async saveForLang(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() key: string, @Path() langCode: string, @Body() body: SaveForLangBody): Promise<ApiOk<unknown>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await transService.saveForLang(access.projectId, key, langCode, body))
  }
}
