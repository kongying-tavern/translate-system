import { Request, Response, NextFunction } from 'express'
import { prisma } from '../index'
import crypto from 'crypto'

export interface ApiKeyRequest extends Request {
  userId?: string
  userRole?: string
}

export function apiKeyAuth(requireRole?: string) {
  const LEVEL: Record<string, number> = { super_admin: 4, senior_admin: 3, admin: 2, member: 1 }
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string
    const secret = req.headers['x-api-secret'] as string
    if (!apiKey || !secret) return res.status(401).json({ code: 1001, message: 'missing x-api-key or x-api-secret', data: null })

    const key = await prisma.apiKey.findUnique({ where: { apiKey, enabled: true } })
    if (!key || key.secret !== sha256(secret)) return res.status(401).json({ code: 1001, message: 'invalid api key or secret', data: null })

    const user = await prisma.user.findUnique({ where: { id: key.userId } })
    if (!user) return res.status(401).json({ code: 1001, message: 'user not found', data: null })

    if (requireRole && (LEVEL[user.role] || 0) < (LEVEL[requireRole] || 0)) {
      return res.status(403).json({ code: 1002, message: '没有权限', data: null })
    }

    req.userId = user.id
    req.userRole = user.role

    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsed: new Date() } })
    next()
  }
}

function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex') }
