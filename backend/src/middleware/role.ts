import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth'
import { ROLE_LEVEL, SystemRole } from '../constants/roles'

export function requireRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if ((ROLE_LEVEL[req.userRole || SystemRole.User] || 0) >= (ROLE_LEVEL[minRole] || 0))
      return next()
    return res.status(403).json({ code: 1002, message: '没有权限', data: null })
  }
}
