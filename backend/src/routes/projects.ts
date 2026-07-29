import type { AuthRequest } from '../middleware/auth'
import { Router } from 'express'
import { ProjectRole, SystemRole } from '../constants/roles'
import { prisma } from '../index'
import { ErrCode } from '../lib/errors'
import { error, success, successWithPage } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership, requireProjectRole } from '../middleware/ownership'
import { requireRole } from '../middleware/role'
import * as langService from '../services/language'
import * as projectService from '../services/project'
import { AppError } from '../utils/AppError'

export const projectRoutes = Router()
projectRoutes.use(authMiddleware)

// ── Projects CRUD ──
projectRoutes.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string || '1')
    const pageSize = Math.min(parseInt(req.query.pageSize as string || '20'), 100)
    const { projects, total } = await projectService.listProjects(req.userId!, page, pageSize)
    successWithPage(res, projects, total, page, pageSize)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.post('/', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== SystemRole.SuperAdmin)
      return error(res, ErrCode.Forbidden, '只有系统超管可以创建项目')
    if (!req.body.name)
      return error(res, ErrCode.InvalidParams, 'name is required')
    if (!req.body.code)
      return error(res, ErrCode.InvalidParams, 'code is required')
    success(res, await projectService.createProject(req.userId!, req.body))
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

projectRoutes.get('/:projectSlug', requireOwnership, async (req: AuthRequest, res) => {
  try {
    const project = await projectService.getProject(req.params.projectSlug)
    success(res, { ...project, projectRole: req.projectRole || null })
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

projectRoutes.put('/:projectSlug', requireOwnership, requireRole(SystemRole.SuperAdmin), async (req: AuthRequest, res) => {
  try {
    success(res, await projectService.updateProject(req.params.projectSlug, req.body))
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

projectRoutes.delete('/:projectSlug', requireOwnership, requireRole(SystemRole.SuperAdmin), async (req: AuthRequest, res) => {
  try {
    await projectService.deleteProject(req.params.projectSlug)
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

// ── Project Languages ──
projectRoutes.get('/:projectSlug/languages', requireOwnership, async (req: AuthRequest, res) => {
  try {
    success(res, await langService.listProjectLanguages(req.params.projectSlug))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.post('/:projectSlug/languages', requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    const { languageCode } = req.body
    if (!languageCode)
      return error(res, ErrCode.InvalidParams, 'languageCode is required')
    success(res, await langService.addProjectLanguage(req.params.projectSlug, languageCode))
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

projectRoutes.delete('/:projectSlug/languages/:langCode', requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    await langService.removeProjectLanguage(req.params.projectSlug, req.params.langCode)
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.put('/:projectSlug/languages/:langCode/alias', requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    success(res, await langService.updateLanguageAlias(req.params.langCode, req.body.alias))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.put('/:projectSlug/languages/:langCode/sortOrder', requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    success(res, await langService.updateLanguageSortOrder(req.params.langCode, req.body.sortOrder))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

// ── Project Members ──
projectRoutes.get('/:projectSlug/members', requireOwnership, async (req: AuthRequest, res) => {
  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectSlug },
      select: { id: true, userId: true, projectRole: true, createdAt: true, user: { select: { username: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    success(res, members.map(m => ({ id: m.id, userId: m.userId, username: m.user.username, email: m.user.email, role: m.user.role, projectRole: m.projectRole, createdAt: m.createdAt })))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.post('/:projectSlug/members', requireOwnership, requireProjectRole(ProjectRole.Admin), async (req: AuthRequest, res) => {
  try {
    const { email, projectRole } = req.body
    const pRole = projectRole || 'member'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return error(res, ErrCode.NotFound, '用户不存在')
    if (req.userRole === SystemRole.Admin && user.role !== SystemRole.User)
      return error(res, ErrCode.Forbidden, '管理员只能将普通用户添加到项目')
    const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: req.params.projectSlug, userId: user.id } } })
    if (existing)
      return error(res, ErrCode.Conflict, '该用户已是项目成员')
    const m = await prisma.projectMember.create({ data: { projectId: req.params.projectSlug, userId: user.id, projectRole: pRole } })
    success(res, { id: m.id, userId: user.id, username: user.username, email: user.email, role: user.role, projectRole: m.projectRole, createdAt: m.createdAt })
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

projectRoutes.put('/:projectSlug/members/:memberId/role', requireOwnership, requireProjectRole(ProjectRole.Admin), async (req: AuthRequest, res) => {
  try {
    await prisma.projectMember.update({ where: { id: req.params.memberId }, data: { projectRole: req.body.projectRole } })
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

projectRoutes.delete('/:projectSlug/members/:memberId', requireOwnership, requireProjectRole(ProjectRole.Admin), async (req: AuthRequest, res) => {
  try {
    await prisma.projectMember.delete({ where: { id: req.params.memberId } })
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
