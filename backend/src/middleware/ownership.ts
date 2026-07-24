import { Response, NextFunction } from 'express'
import { prisma } from '../index'
import { AuthRequest } from './auth'
import { ErrCode } from '../lib/errors'

const PROJECT_ROLE_LEVEL: Record<string, number> = { admin: 3, maintainer: 2, member: 1 }

async function resolveProject(identifier: string) {
  let p = await prisma.project.findUnique({ where: { id: identifier } })
  if (!p) p = await prisma.project.findUnique({ where: { code: identifier } })
  return p
}

export async function requireOwnership(req: AuthRequest, res: Response, next: NextFunction) {
  const identifier = req.params.projectSlug
  const project = await resolveProject(identifier)
  if (!project) return res.status(404).json({ code: ErrCode.NotFound, message: 'project not found', data: null })
  req.params.projectSlug = project.id

  // System super_admin has full access
  if (req.userRole === 'super_admin') return next()

  // Project owner has full access
  if (project.userId === req.userId!) { req.projectRole = 'admin'; return next() }

  // Check project membership
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: req.userId! } }
  })
  if (!member) return res.status(403).json({ code: ErrCode.Forbidden, message: '无项目权限', data: null })
  req.projectRole = member.projectRole
  next()
}

export function requireProjectRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userLevel = PROJECT_ROLE_LEVEL[(req as any).projectRole || 'member'] || 0
    if (userLevel >= (PROJECT_ROLE_LEVEL[minRole] || 0)) return next()
    return res.status(403).json({ code: ErrCode.Forbidden, message: '项目权限不足', data: null })
  }
}
