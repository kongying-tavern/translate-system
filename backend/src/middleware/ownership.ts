import { Response, NextFunction } from 'express'
import { prisma } from '../index'
import { AuthRequest } from './auth'
import { ErrCode } from '../lib/errors'

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
  if (project.userId === req.userId!) return next()
  if (await prisma.projectMember.count({ where: { projectId: project.id, userId: req.userId! } }) > 0) return next()
  return res.status(403).json({ code: ErrCode.Forbidden, message: '无项目权限', data: null })
}
