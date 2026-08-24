import type { ApiOk, ApiPage } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Put, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole, SystemRole } from '../constants/roles'
import { assertProjectAccess, assertSystemRole } from '../lib/access'
import { ok, okPage } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { decodePathParams } from '../middleware/decodePathParams'
import * as langService from '../services/language'
import * as projectService from '../services/project'
import { AppError } from '../utils/AppError'

export interface ProjectRow {
  /** 项目 ID */
  id: string
  /** 创建者用户 ID */
  userId: string
  /** 项目标识 */
  code: string
  /** 项目名称 */
  name: string
  /** 项目描述 */
  description: string | null
  /** 源语言 */
  sourceLanguage: string
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 当前用户项目角色 */
  projectRole?: string | null
}

export interface CreateProjectBody {
  /**
   * 项目名称
   * @example "我的项目"
   */
  name: string
  /**
   * 项目标识（code，唯一且用于 URL，如 my-project）
   * @example "my-project"
   */
  code: string
  /**
   * 项目描述
   * @example "示例项目"
   */
  description?: string
  /**
   * 源语言（基础语言代码，必填；保存时会自动添加为项目语言并置顶）
   * @example "zh-Hans"
   */
  sourceLanguage: string
}

export interface UpdateProjectBody {
  /** 项目名称 */
  name?: string
  /** 项目标识 */
  code?: string
  /** 项目描述 */
  description?: string
  /** 源语言 */
  sourceLanguage?: string
}

export interface AddLanguageBody {
  /** 语言代码 */
  languageCode: string
}

export interface SourceLanguageBody {
  /**
   * 源语言代码（若不在项目语言中会自动添加并置顶）
   * @example "zh-Hans"
   */
  languageCode: string
}

export interface CodeAliasBody {
  /** 代码别名 */
  codeAlias: string
}

export interface NameAliasBody {
  /** 语言别名（显示名称优先用：语言别名 || 基础语言名称） */
  nameAlias: string
}

export interface SortOrderBody {
  /** 语言排序值 */
  sortOrder: number
}

export interface MemberRow {
  /** 成员关系 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email: string
  /** 系统角色 */
  role: string
  /** 项目角色 */
  projectRole: string
  /** 加入时间 */
  createdAt: Date
}

export interface AddMemberBody {
  /**
   * 用户邮箱（被添加用户需已注册）
   * @example "user@example.com"
   */
  email: string
  /**
   * 项目角色（admin/maintainer/member）
   * @example "maintainer"
   */
  projectRole: string
}

export interface MemberRoleBody {
  /** 项目角色 */
  projectRole: string
}

export interface ProjectLanguageRow {
  /** 语言记录 ID */
  id: string
  /** 项目 ID */
  projectId: string
  /** 语言代码 */
  languageCode: string
  /** 代码别名 */
  codeAlias: string | null
  /** 名称别名（显示名称优先用：名称别名 || 基础语言名称） */
  nameAlias: string | null
  /** 排序值 */
  sortOrder: number
  /** 创建时间 */
  createdAt: Date
}

@Route('projects')
@Tags('Projects')
@Middlewares(decodePathParams)
export class ProjectsController extends Controller {
  /**
   * 项目列表（分页，仅返回自己有成员/owner 身份的项目）
   * @param req 请求对象
   * @param page 页码
   * @param pageSize 每页数量
   * @summary 项目列表
   */
  @Get()
  @Security('auth')
  public async list(@Request() req: AuthRequest, @Query() page?: string, @Query() pageSize?: string): Promise<ApiOk<ApiPage<ProjectRow>>> {
    const p = Math.max(1, parseInt(page || '1'))
    const size = Math.min(parseInt(pageSize || '20'), 100)
    const { rows, total } = await projectService.listProjects(req.userId!, req.userRole!, p, size)
    return okPage(rows as unknown as ProjectRow[], total, p, size)
  }

  /**
   * 创建项目（仅系统超管）
   * @param req 请求对象
   * @param body 请求体
   * @summary 创建项目
   */
  @Post()
  @Security('auth')
  public async create(@Request() req: AuthRequest, @Body() body: CreateProjectBody): Promise<ApiOk<ProjectRow>> {
    assertSystemRole(req.userRole!, SystemRole.SuperAdmin)
    if (!body.name)
      throw new AppError(ErrCode.InvalidParams, 'name is required')
    if (!body.code)
      throw new AppError(ErrCode.InvalidParams, 'code is required')
    return ok(await projectService.createProject(req.userId!, body))
  }

  /**
   * 获取项目详情
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 获取项目详情
   */
  @Get('{projectSlug}')
  @Security('auth')
  public async getOne(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ProjectRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const project = await projectService.getProject(access.projectId)
    return ok({ ...project, projectRole: access.projectRole || null })
  }

  /**
   * 更新项目（仅系统超管）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 更新项目
   */
  @Put('{projectSlug}')
  @Security('auth')
  public async update(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: UpdateProjectBody): Promise<ApiOk<ProjectRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    assertSystemRole(req.userRole!, SystemRole.SuperAdmin)
    return ok(await projectService.updateProject(access.projectId, body))
  }

  /**
   * 删除项目（仅系统超管）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 删除项目
   */
  @Delete('{projectSlug}')
  @Security('auth')
  public async remove(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    assertSystemRole(req.userRole!, SystemRole.SuperAdmin)
    await projectService.deleteProject(access.projectId)
    return ok(null)
  }

  /**
   * 项目语言列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 项目语言列表
   */
  @Get('{projectSlug}/languages')
  @Security('auth')
  public async listLanguages(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ProjectLanguageRow[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await langService.listProjectLanguages(access.projectId) as ProjectLanguageRow[])
  }

  /**
   * 添加项目语言
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 添加项目语言
   */
  @Post('{projectSlug}/languages')
  @Security('auth')
  public async addLanguage(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: AddLanguageBody): Promise<ApiOk<ProjectLanguageRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.languageCode)
      throw new AppError(ErrCode.InvalidParams, 'languageCode is required')
    return ok(await langService.addProjectLanguage(access.projectId, body.languageCode) as ProjectLanguageRow)
  }

  /**
   * 移除项目语言
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param langCode 语言代码
   * @summary 移除项目语言
   */
  @Delete('{projectSlug}/languages/{langCode}')
  @Security('auth')
  public async removeLanguage(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await langService.removeProjectLanguage(access.projectId, langCode)
    return ok(null)
  }

  /**
   * 设置代码别名
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param langCode 语言代码
   * @param body 请求体
   * @summary 设置代码别名
   */
  @Put('{projectSlug}/languages/{langCode}/codeAlias')
  @Security('auth')
  public async updateCodeAlias(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string, @Body() body: CodeAliasBody): Promise<ApiOk<ProjectLanguageRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await langService.updateLanguageCodeAlias(access.projectId, langCode, body.codeAlias) as ProjectLanguageRow)
  }

  /**
   * 设置语言别名
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param langCode 语言记录 ID
   * @param body 请求体
   * @summary 设置语言别名
   */
  @Put('{projectSlug}/languages/{langCode}/nameAlias')
  @Security('auth')
  public async updateNameAlias(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string, @Body() body: NameAliasBody): Promise<ApiOk<ProjectLanguageRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await langService.updateLanguageNameAlias(access.projectId, langCode, body.nameAlias) as ProjectLanguageRow)
  }

  /**
   * 设置语言排序
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param langCode 语言代码
   * @param body 请求体
   * @summary 设置语言排序
   */
  @Put('{projectSlug}/languages/{langCode}/sortOrder')
  @Security('auth')
  public async updateSortOrder(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string, @Body() body: SortOrderBody): Promise<ApiOk<ProjectLanguageRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await langService.updateLanguageSortOrder(access.projectId, langCode, body.sortOrder) as ProjectLanguageRow)
  }

  /**
   * 设置项目源语言（若不在项目语言中会自动添加并置顶）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 设置源语言
   */
  @Put('{projectSlug}/sourceLanguage')
  @Security('auth')
  public async setSourceLanguage(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: SourceLanguageBody): Promise<ApiOk<ProjectRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.languageCode)
      throw new AppError(ErrCode.InvalidParams, 'languageCode is required')
    return ok(await projectService.setProjectSourceLanguage(access.projectId, body.languageCode) as unknown as ProjectRow)
  }

  /**
   * 项目成员列表
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 项目成员列表
   */
  @Get('{projectSlug}/members')
  @Security('auth')
  public async listMembers(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<MemberRow[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const members = await prisma.projectMember.findMany({
      where: { projectId: access.projectId },
      select: { id: true, userId: true, projectRole: true, createdAt: true, user: { select: { username: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return ok(members.map(m => ({ id: m.id, userId: m.userId, username: m.user.username, email: m.user.email, role: m.user.role, projectRole: m.projectRole, createdAt: m.createdAt })))
  }

  /**
   * 添加项目成员
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 添加项目成员
   */
  @Post('{projectSlug}/members')
  @Security('auth')
  public async addMember(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: AddMemberBody): Promise<ApiOk<MemberRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Admin)
    const { email, projectRole } = body
    const pRole = projectRole || 'member'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      throw new AppError(ErrCode.NotFound, '用户不存在')
    if (req.userRole === SystemRole.Admin && user.role !== SystemRole.User)
      throw new AppError(ErrCode.Forbidden, '管理员只能将普通用户添加到项目')
    const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: access.projectId, userId: user.id } } })
    if (existing)
      throw new AppError(ErrCode.Conflict, '该用户已是项目成员')
    const m = await prisma.projectMember.create({ data: { projectId: access.projectId, userId: user.id, projectRole: pRole } })
    return ok({ id: m.id, userId: user.id, username: user.username, email: user.email, role: user.role, projectRole: m.projectRole, createdAt: m.createdAt })
  }

  /**
   * 修改成员项目角色
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param memberId 成员关系 ID
   * @param body 请求体
   * @summary 修改成员项目角色
   */
  @Put('{projectSlug}/members/{memberId}/role')
  @Security('auth')
  public async updateMemberRole(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() memberId: string, @Body() body: MemberRoleBody): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Admin)
    const { count } = await prisma.projectMember.updateMany({ where: { id: memberId, projectId: access.projectId }, data: { projectRole: body.projectRole } })
    if (count === 0)
      throw new AppError(ErrCode.NotFound, '成员不存在或已被移除')
    return ok(null)
  }

  /**
   * 移除项目成员
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param memberId 成员关系 ID
   * @summary 移除项目成员
   */
  @Delete('{projectSlug}/members/{memberId}')
  @Security('auth')
  public async removeMember(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() memberId: string): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Admin)
    const { count } = await prisma.projectMember.deleteMany({ where: { id: memberId, projectId: access.projectId } })
    if (count === 0)
      throw new AppError(ErrCode.NotFound, '成员不存在或已被移除')
    return ok(null)
  }
}
