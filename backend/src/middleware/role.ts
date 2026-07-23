import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

// Minimum role level to access
const LEVEL: Record<string, number> = { super_admin: 4, senior_admin: 3, admin: 2, member: 1 }

export function requireRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userLevel = LEVEL[req.userRole || 'member'] || 0
    if (userLevel < (LEVEL[minRole] || 0)) {
      return res.status(403).json({ code: 1002, message: '没有权限', data: null })
    }
    next()
  }
}
