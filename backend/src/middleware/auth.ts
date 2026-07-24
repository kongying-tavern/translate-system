import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { ErrCode } from '../lib/errors'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
  projectRole?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Skip JWT if already authenticated via API key
  if (req.userId) return next()
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: ErrCode.Unauthorized, message: 'missing or invalid authorization header', data: null })
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string; role: string }
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ code: ErrCode.Unauthorized, message: 'invalid or expired token', data: null })
  }
}
