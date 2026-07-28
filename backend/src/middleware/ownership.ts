import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth'
import { PROJECT_ROLE_LEVEL, ProjectRole, SystemRole } from '../constants/roles'
import { prisma } from '../index'
import { ErrCode } from '../lib/errors'

async function resolveProject(identifier: string) {
  let p = null
  try {
    p = await prisma.project.findUnique({ where: { id: identifier } })
  }
  catch {}
  if (!p)
    p = await prisma.project.findUnique({ where: { code: identifier } })
  return p
}

export async function requireOwnership(req: AuthRequest, res: Response, next: NextFunction) {
  const identifier = req.params.projectSlug
  const project = await resolveProject(identifier)
  if (!project)
    return res.status(404).json({ code: ErrCode.NotFound, message: 'project not found', data: null })
  req.params.projectSlug = project.id

  // System super_admin has full access
  if (req.userRole === SystemRole.SuperAdmin)
    return next()

  // Project owner has full access
  if (project.userId === req.userId!) {
    req.projectRole = ProjectRole.Admin
    return next()
  }

  // Check project membership
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: req.userId! } },
  })
  if (!member)
    return res.status(403).json({ code: ErrCode.Forbidden, message: '无项目权限', data: null })
  req.projectRole = member.projectRole
  next()
}

export function requireProjectRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userLevel = PROJECT_ROLE_LEVEL[req.projectRole || ProjectRole.Member] || 0
    if (userLevel >= (PROJECT_ROLE_LEVEL[minRole] || 0))
      return next()
    return res.status(403).json({ code: ErrCode.Forbidden, message: '项目权限不足', data: null })
  }
}
