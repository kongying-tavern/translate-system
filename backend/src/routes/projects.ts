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
    success(res, await projectService.createProject(req.userId, req.body))
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.get('/:projectId', requireOwnership, async (req: any, res, next) => {
  try { success(res, await projectService.getProject(req.params.projectId)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.put('/:projectId', requireOwnership, async (req: any, res, next) => {
  try { success(res, await projectService.updateProject(req.params.projectId, req.body)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectId', requireOwnership, async (req: any, res, next) => {
  try { await projectService.deleteProject(req.params.projectId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// ── Project Languages ──
projectRoutes.get('/:projectId/languages', requireOwnership, async (req: any, res, next) => {
  try { success(res, await langService.listProjectLanguages(req.params.projectId)) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.post('/:projectId/languages', requireOwnership, async (req: any, res, next) => {
  try {
    const { languageCode } = req.body
    if (!languageCode) return error(res, ErrCode.InvalidParams, 'languageCode is required')
    success(res, await langService.addProjectLanguage(req.params.projectId, languageCode))
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectId/languages/:langCode', requireOwnership, async (req: any, res, next) => {
  try { await langService.removeProjectLanguage(req.params.projectId, req.params.langCode); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.put('/:projectId/languages/:langCode/alias', requireOwnership, async (req: any, res, next) => {
  try { success(res, await langService.updateLanguageAlias(req.params.langCode, req.body.alias)) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// ── Project Members ──
projectRoutes.get('/:projectId/members', requireOwnership, async (req: any, res, next) => {
  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectId },
      select: { id: true, userId: true, createdAt: true, user: { select: { username: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    })
    success(res, members.map((m: any) => ({ id: m.id, userId: m.userId, username: m.user.username, email: m.user.email, role: m.user.role, createdAt: m.createdAt })))
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

projectRoutes.post('/:projectId/members', requireOwnership, async (req: any, res, next) => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return error(res, ErrCode.NotFound, '用户不存在')
    if (req.userRole === 'admin' && user.role !== 'member') return error(res, ErrCode.Forbidden, '管理员只能添加成员到项目')
    if (req.userRole === 'senior_admin' && user.role === 'super_admin') return error(res, ErrCode.Forbidden, '高级管理员不能添加超级管理员')
    const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: req.params.projectId, userId: user.id } } })
    if (existing) return error(res, ErrCode.Conflict, '该用户已是项目成员')
    const m = await prisma.projectMember.create({ data: { projectId: req.params.projectId, userId: user.id } })
    success(res, { id: m.id, userId: user.id, username: user.username, email: user.email, role: user.role, createdAt: m.createdAt })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

projectRoutes.delete('/:projectId/members/:memberId', requireOwnership, async (req: any, res, next) => {
  try {
    if (req.userRole === 'admin' || req.userRole === 'senior_admin') {
      const m = await prisma.projectMember.findUnique({ where: { id: req.params.memberId }, include: { user: { select: { role: true } } } })
      if (req.userRole === 'admin' && m?.user.role !== 'member') return error(res, ErrCode.Forbidden, '管理员只能移除成员')
      if (req.userRole === 'senior_admin' && m?.user.role === 'super_admin') return error(res, ErrCode.Forbidden, '高级管理员不能移除超级管理员')
    }
    await prisma.projectMember.delete({ where: { id: req.params.memberId } }); success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
