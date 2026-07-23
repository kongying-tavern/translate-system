import { Response, NextFunction } from 'express'
import { prisma } from '../index'
import { AuthRequest } from './auth'
import { ErrCode } from '../lib/errors'

export async function requireOwnership(req: AuthRequest, res: Response, next: NextFunction) {
  const projectId = req.params.projectId
  if (await prisma.project.count({ where: { id: projectId, userId: req.userId! } }) > 0) return next()
  if (await prisma.projectMember.count({ where: { projectId, userId: req.userId! } }) > 0) return next()
  return res.status(403).json({ code: ErrCode.Forbidden, message: '无项目权限', data: null })
}
