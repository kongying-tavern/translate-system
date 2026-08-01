import type { Prisma } from '@prisma/client'
import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok } from '../lib/api'
import * as exportService from '../services/export'
import * as langService from '../services/language'
import * as transService from '../services/translation'

export interface ExportTemplateRow {
  /** 记录 ID */
  id: string
  /** 所属项目 ID */
  projectId: string
  /** 模板名称 */
  name: string
  /** 模板标识 */
  code: string
  /** 模板描述 */
  description: string | null
  /** 导出格式类型 */
  formatType: string
  /** 模板配置对象 */
  config: Record<string, unknown>
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

export interface ExportTemplateInput {
  /** 模板名称 */
  name?: string
  /** 模板标识 */
  code: string
  /** 模板描述 */
  description?: string
  /** 导出格式类型 */
  formatType: string
  /** 模板配置对象 */
  config?: Record<string, unknown>
}

export interface ExportReqBody {
  /** 模板标识 */
  templateSlug: string
  /** 导出语言列表 */
  languageCodes: string[]
  /** 过滤标签 */
  filterTags?: string[]
}

export interface ExportResult {
  /** 导出内容 */
  content: string
  /** 导出格式 */
  format: string
  /** 字符编码 */
  encoding?: string
}

@Route('projects')
@Tags('Exports')
export class ExportsController extends Controller {
  /**
   * 导出模板列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   */
  @Get('{projectSlug}/exports/templates')
  @Security('auth')
  public async listTemplates(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ExportTemplateRow[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await exportService.listTemplates(access.projectId)) as unknown as ExportTemplateRow[])
  }

  /**
   * 创建导出模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   */
  @Post('{projectSlug}/exports/templates')
  @Security('auth')
  public async createTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ExportTemplateInput): Promise<ApiOk<ExportTemplateRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok((await exportService.createTemplate(access.projectId, body as unknown as Omit<Prisma.ExportTemplateUncheckedCreateInput, 'id' | 'projectId'>)) as unknown as ExportTemplateRow)
  }

  /**
   * 获取单个导出模板详情
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateSlug 模板标识
   * @summary 导出模板详情
   */
  @Get('{projectSlug}/exports/templates/{templateSlug}')
  @Security('auth')
  public async getTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateSlug: string): Promise<ApiOk<ExportTemplateRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await exportService.getTemplate(templateSlug, access.projectId)) as unknown as ExportTemplateRow)
  }

  /**
   * 更新导出模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateSlug 模板标识
   * @param body 请求体
   */
  @Put('{projectSlug}/exports/templates/{templateSlug}')
  @Security('auth')
  public async updateTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateSlug: string, @Body() body: Partial<ExportTemplateInput>): Promise<ApiOk<ExportTemplateRow>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok((await exportService.updateTemplate(templateSlug, body as unknown as Prisma.ExportTemplateUncheckedUpdateInput)) as unknown as ExportTemplateRow)
  }

  /**
   * 删除导出模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateSlug 模板标识
   */
  @Delete('{projectSlug}/exports/templates/{templateSlug}')
  @Security('auth')
  public async deleteTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateSlug: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await exportService.deleteTemplate(templateSlug)
    return ok(null)
  }

  /**
   * 导出预览（返回文本内容，不下载文件）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 导出预览
   */
  @Post('{projectSlug}/exports/preview')
  @Security('auth')
  public async preview(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ExportReqBody): Promise<ApiOk<ExportResult>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const t = await exportService.getTemplate(body.templateSlug, access.projectId)
    const [translations, langInfo] = await Promise.all([
      transService.getForExport(access.projectId, body.languageCodes),
      langService.getLanguageDisplayMap(access.projectId),
    ])
    const [content, format, encoding] = exportService.exportTranslations(
      translations,
      body.languageCodes,
      t.formatType,
      langInfo.aliases,
      t.config as Record<string, unknown>,
      body.filterTags,
    )
    return ok({ content, format, ...(encoding ? { encoding } : {}) })
  }

  /**
   * 生成导出文件（返回可下载内容，配合 API Key 自动化）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 生成导出文件
   */
  @Post('{projectSlug}/exports/generate')
  @Security('auth')
  public async generate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ExportReqBody): Promise<ApiOk<ExportResult>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const t = await exportService.getTemplate(body.templateSlug, access.projectId)
    const [translations, langInfo] = await Promise.all([
      transService.getForExport(access.projectId, body.languageCodes),
      langService.getLanguageDisplayMap(access.projectId),
    ])
    const [content, format, encoding] = exportService.exportTranslations(
      translations,
      body.languageCodes,
      t.formatType,
      langInfo.aliases,
      t.config as Record<string, unknown>,
      body.filterTags,
    )
    return ok({ content, format, ...(encoding ? { encoding } : {}) })
  }
}
