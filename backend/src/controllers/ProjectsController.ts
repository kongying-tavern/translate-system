import type { ProjectLanguage } from '@prisma/client'
import type { ApiOk, ApiPage } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole, SystemRole } from '../constants/roles'
import { assertProjectAccess, assertSystemRole } from '../lib/access'
import { ok, okPage } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import * as langService from '../services/language'
import * as projectService from '../services/project'
import { AppError } from '../utils/AppError'

export interface ProjectRow {
  id: string
  userId: string
  code: string
  name: string
  description: string | null
  sourceLanguage: string
  createdAt: Date
  updatedAt: Date
  projectRole?: string | null
}

export interface CreateProjectBody {
  name: string
  code: string
  description?: string
  sourceLanguage?: string
}

export interface UpdateProjectBody {
  name?: string
  code?: string
  description?: string
  sourceLanguage?: string
}

export interface AddLanguageBody {
  languageCode: string
}

export interface AliasBody {
  alias: string
}

export interface SortOrderBody {
  sortOrder: number
}

export interface MemberRow {
  id: string
  userId: string
  username: string
  email: string
  role: string
  projectRole: string
  createdAt: Date
}

export interface AddMemberBody {
  email: string
  projectRole: string
}

export interface MemberRoleBody {
  projectRole: string
}

@Route('projects')
@Tags('Projects')
export class ProjectsController extends Controller {
  /** 项目列表（分页，仅返回自己有成员/owner 身份的项目） */
  @Get()
  @Security('auth')
  public async list(@Request() req: AuthRequest, @Query() page?: string, @Query() pageSize?: string): Promise<ApiOk<ApiPage<ProjectRow>>> {
    const p = Math.max(1, parseInt(page || '1'))
    const size = Math.min(parseInt(pageSize || '20'), 100)
    const { projects, total } = await projectService.listProjects(req.userId!, p, size)
    return okPage(projects as unknown as ProjectRow[], total, p, size)
  }

  /** 创建项目（仅系统超管） */
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

  /** 获取项目详情 */
  @Get('{projectSlug}')
  @Security('auth')
  public async getOne(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ProjectRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    const project = await projectService.getProject(access.projectId)
    return ok({ ...project, projectRole: access.projectRole || null })
  }

  /** 更新项目（仅系统超管） */
  @Put('{projectSlug}')
  @Security('auth')
  public async update(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: UpdateProjectBody): Promise<ApiOk<ProjectRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    assertSystemRole(req.userRole!, SystemRole.SuperAdmin)
    return ok(await projectService.updateProject(access.projectId, body))
  }

  /** 删除项目（仅系统超管） */
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
   * @summary 项目语言列表
   */
  @Get('{projectSlug}/languages')
  @Security('auth')
  public async listLanguages(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ProjectLanguage[]>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await langService.listProjectLanguages(access.projectId))
  }

  /** 添加项目语言 */
  @Post('{projectSlug}/languages')
  @Security('auth')
  public async addLanguage(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: AddLanguageBody): Promise<ApiOk<ProjectLanguage>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.languageCode)
      throw new AppError(ErrCode.InvalidParams, 'languageCode is required')
    return ok(await langService.addProjectLanguage(access.projectId, body.languageCode))
  }

  /** 移除项目语言 */
  @Delete('{projectSlug}/languages/{langCode}')
  @Security('auth')
  public async removeLanguage(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string): Promise<ApiOk<null>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    await langService.removeProjectLanguage(access.projectId, langCode)
    return ok(null)
  }

  /** 设置语言别名 */
  @Put('{projectSlug}/languages/{langCode}/alias')
  @Security('auth')
  public async updateAlias(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string, @Body() body: AliasBody): Promise<ApiOk<ProjectLanguage>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await langService.updateLanguageAlias(langCode, body.alias))
  }

  /** 设置语言排序 */
  @Put('{projectSlug}/languages/{langCode}/sortOrder')
  @Security('auth')
  public async updateSortOrder(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() langCode: string, @Body() body: SortOrderBody): Promise<ApiOk<ProjectLanguage>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    return ok(await langService.updateLanguageSortOrder(langCode, body.sortOrder))
  }

  /** 项目成员列表 */
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

  /** 添加项目成员 */
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

  /** 修改成员项目角色 */
  @Put('{projectSlug}/members/{memberId}/role')
  @Security('auth')
  public async updateMemberRole(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() memberId: string, @Body() body: MemberRoleBody): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Admin)
    await prisma.projectMember.update({ where: { id: memberId }, data: { projectRole: body.projectRole } })
    return ok(null)
  }

  /** 移除项目成员 */
  @Delete('{projectSlug}/members/{memberId}')
  @Security('auth')
  public async removeMember(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Path() memberId: string): Promise<ApiOk<null>> {
    await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Admin)
    await prisma.projectMember.delete({ where: { id: memberId } })
    return ok(null)
  }
}
