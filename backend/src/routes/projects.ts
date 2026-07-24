import { Router } from 'express'
import { prisma } from '../index'
import * as projectService from '../services/project'
import * as langService from '../services/language'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, successWithPage, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const projectRoutes = Router()
projectRoutes.use(authMiddleware as any)

// ── Projects CRUD ──
projectRoutes.get('/', async (req: any, res, next) => {
  try {
    const page = parseInt(req.query.page || '1')
    const pageSize = Math.min(parseInt(req.query.pageSize || '20'), 100)
    const { projects, total } = await projectService.listProjects(req.userId, page, pageSize)
    successWithPage(res, projects, total, page, pageSize)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.post('/', async (req: any, res, next) => {
  try {
    if (req.userRole !== 'super_admin') return error(res, ErrCode.Forbidden, '只有超级管理员可以创建项目')
    if (!req.body.name) return error(res, ErrCode.InvalidParams, 'name is required')
    if (!req.body.code) return error(res, ErrCode.InvalidParams, 'code is required')
    success(res, await projectService.createProject(req.userId, req.body))
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.get('/:projectSlug', requireOwnership, async (req: any, res, next) => {
  try { success(res, await projectService.getProject(req.params.projectSlug)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.put('/:projectSlug', requireOwnership, async (req: any, res, next) => {
  try { success(res, await projectService.updateProject(req.params.projectSlug, req.body)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectSlug', requireOwnership, async (req: any, res, next) => {
  try { await projectService.deleteProject(req.params.projectSlug); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// ── Project Languages ──
projectRoutes.get('/:projectSlug/languages', requireOwnership, async (req: any, res, next) => {
  try { success(res, await langService.listProjectLanguages(req.params.projectSlug)) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.post('/:projectSlug/languages', requireOwnership, async (req: any, res, next) => {
  try {
    const { languageCode } = req.body
    if (!languageCode) return error(res, ErrCode.InvalidParams, 'languageCode is required')
    success(res, await langService.addProjectLanguage(req.params.projectSlug, languageCode))
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectSlug/languages/:langCode', requireOwnership, async (req: any, res, next) => {
  try { await langService.removeProjectLanguage(req.params.projectSlug, req.params.langCode); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.put('/:projectSlug/languages/:langCode/alias', requireOwnership, async (req: any, res, next) => {
  try { success(res, await langService.updateLanguageAlias(req.params.langCode, req.body.alias)) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.put('/:projectSlug/languages/:langCode/sortOrder', requireOwnership, async (req: any, res, next) => {
  try { success(res, await langService.updateLanguageSortOrder(req.params.langCode, req.body.sortOrder)) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// ── Project Members ──
projectRoutes.get('/:projectSlug/members', requireOwnership, async (req: any, res, next) => {
  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectSlug },
      select: { id: true, userId: true, createdAt: true, user: { select: { username: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    })
    success(res, members.map((m: any) => ({ id: m.id, userId: m.userId, username: m.user.username, email: m.user.email, role: m.user.role, createdAt: m.createdAt })))
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.post('/:projectSlug/members', requireOwnership, async (req: any, res, next) => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return error(res, ErrCode.NotFound, '用户不存在')
    if (req.userRole === 'admin' && user.role !== 'member') return error(res, ErrCode.Forbidden, '管理员只能添加成员到项目')
    if (req.userRole === 'senior_admin' && user.role === 'super_admin') return error(res, ErrCode.Forbidden, '高级管理员不能添加超级管理员')
    const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: req.params.projectSlug, userId: user.id } } })
    if (existing) return error(res, ErrCode.Conflict, '该用户已是项目成员')
    const m = await prisma.projectMember.create({ data: { projectId: req.params.projectSlug, userId: user.id } })
    success(res, { id: m.id, userId: user.id, username: user.username, email: user.email, role: user.role, createdAt: m.createdAt })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectSlug/members/:memberId', requireOwnership, async (req: any, res, next) => {
  try {
    if (req.userRole === 'admin' || req.userRole === 'senior_admin') {
      const m = await prisma.projectMember.findUnique({ where: { id: req.params.memberId }, include: { user: { select: { role: true } } } })
      if (req.userRole === 'admin' && m?.user.role !== 'member') return error(res, ErrCode.Forbidden, '管理员只能移除成员')
      if (req.userRole === 'senior_admin' && m?.user.role === 'super_admin') return error(res, ErrCode.Forbidden, '高级管理员不能移除超级管理员')
    }
    await prisma.projectMember.delete({ where: { id: req.params.memberId } }); success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
