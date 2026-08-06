import type { Prisma } from '@prisma/client'
import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { assertProjectAccess } from '../lib/access'
import { ok } from '../lib/api'
import * as layoutService from '../services/layout'

export interface LayoutTemplateRow {
  /** 模板 ID */
  id: string
  /** 所属项目 ID */
  projectId: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string | null
  /** JSON 配置对象 */
  config: Record<string, unknown>
  /** 缩略图地址 */
  thumbnailUrl: string | null
  /** 是否为默认模板 */
  isDefault: boolean
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

export interface LayoutConfigRow {
  /** 配置 ID */
  id: string
  /** 所属项目 ID */
  projectId: string
  /** 关联模板 ID */
  templateId: string | null
  /** 配置名称 */
  name: string
  /** 覆盖项配置 */
  overrideConfig: Record<string, unknown>
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

export interface LayoutTemplateInput {
  /** 模板名称 */
  name: string
  /** JSON 配置对象 */
  config?: Record<string, unknown>
}

export interface LayoutConfigInput {
  /** 关联模板 ID */
  templateId?: string
  /** 配置名称 */
  name: string
  /** 覆盖项配置 */
  overrideConfig?: Record<string, unknown>
}

@Route('projects')
@Tags('Layouts')
export class LayoutsController extends Controller {
  /**
   * 布局模板列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 布局模板列表
   */
  @Get('{projectSlug}/layouts/templates')
  @Security('auth')
  public async listTemplates(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<LayoutTemplateRow[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.listTemplates(access.projectId)) as unknown as LayoutTemplateRow[])
  }

  /**
   * 创建布局模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 创建布局模板
   */
  @Post('{projectSlug}/layouts/templates')
  @Security('auth')
  public async createTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: LayoutTemplateInput): Promise<ApiOk<LayoutTemplateRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.createTemplate(access.projectId, body as unknown as Omit<Prisma.LayoutTemplateUncheckedCreateInput, 'id' | 'projectId'>)) as unknown as LayoutTemplateRow)
  }

  /**
   * 获取布局模板详情
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateId 模板 ID
   * @summary 获取布局模板详情
   */
  @Get('{projectSlug}/layouts/templates/{templateId}')
  @Security('auth')
  public async getTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateId: string): Promise<ApiOk<LayoutTemplateRow>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.getTemplate(templateId)) as unknown as LayoutTemplateRow)
  }

  /**
   * 更新布局模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateId 模板 ID
   * @param body 请求体
   * @summary 更新布局模板
   */
  @Put('{projectSlug}/layouts/templates/{templateId}')
  @Security('auth')
  public async updateTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateId: string, @Body() body: Partial<LayoutTemplateInput>): Promise<ApiOk<LayoutTemplateRow>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.updateTemplate(templateId, body as unknown as Prisma.LayoutTemplateUncheckedUpdateInput)) as unknown as LayoutTemplateRow)
  }

  /**
   * 删除布局模板
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param templateId 模板 ID
   * @summary 删除布局模板
   */
  @Delete('{projectSlug}/layouts/templates/{templateId}')
  @Security('auth')
  public async deleteTemplate(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() templateId: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    await layoutService.deleteTemplate(templateId)
    return ok(null)
  }

  /**
   * 布局配置列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 布局配置列表
   */
  @Get('{projectSlug}/layouts/configs')
  @Security('auth')
  public async listConfigs(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<LayoutConfigRow[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.listConfigs(access.projectId)) as unknown as LayoutConfigRow[])
  }

  /**
   * 创建布局配置
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 创建布局配置
   */
  @Post('{projectSlug}/layouts/configs')
  @Security('auth')
  public async createConfig(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: LayoutConfigInput): Promise<ApiOk<LayoutConfigRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.createConfig(access.projectId, body as unknown as Omit<Prisma.LayoutConfigUncheckedCreateInput, 'id' | 'projectId'>)) as unknown as LayoutConfigRow)
  }

  /**
   * 获取布局配置详情
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param configId 配置 ID
   * @summary 获取布局配置详情
   */
  @Get('{projectSlug}/layouts/configs/{configId}')
  @Security('auth')
  public async getConfig(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() configId: string): Promise<ApiOk<LayoutConfigRow>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.getConfig(configId)) as unknown as LayoutConfigRow)
  }

  /**
   * 更新布局配置
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param configId 配置 ID
   * @param body 请求体
   * @summary 更新布局配置
   */
  @Put('{projectSlug}/layouts/configs/{configId}')
  @Security('auth')
  public async updateConfig(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() configId: string, @Body() body: Partial<LayoutConfigInput>): Promise<ApiOk<LayoutConfigRow>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok((await layoutService.updateConfig(configId, body as unknown as Prisma.LayoutConfigUncheckedUpdateInput)) as unknown as LayoutConfigRow)
  }

  /**
   * 删除布局配置
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param configId 配置 ID
   * @summary 删除布局配置
   */
  @Delete('{projectSlug}/layouts/configs/{configId}')
  @Security('auth')
  public async deleteConfig(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() configId: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    await layoutService.deleteConfig(configId)
    return ok(null)
  }

  /**
   * 获取合并模板与覆盖项的最终配置
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param configId 配置 ID
   * @summary 获取最终布局配置
   */
  @Get('{projectSlug}/layouts/configs/{configId}/resolved')
  @Security('auth')
  public async getResolvedConfig(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() configId: string): Promise<ApiOk<Record<string, unknown>>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await layoutService.getResolvedConfig(configId))
  }
}
