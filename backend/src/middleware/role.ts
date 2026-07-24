import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

const LEVEL: Record<string, number> = { super_admin: 3, admin: 2, member: 1 }

export function requireRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if ((LEVEL[req.userRole || 'member'] || 0) >= (LEVEL[minRole] || 0)) return next()
    return res.status(403).json({ code: 1002, message: '没有权限', data: null })
  }
}
