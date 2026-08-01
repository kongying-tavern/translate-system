import type { Request } from 'express'
import jwt from 'jsonwebtoken'
import { config } from './config'
import { ROLE_LEVEL, SystemRole } from './constants/roles'
import { ErrCode } from './lib/errors'
import { AppError } from './utils/AppError'

export interface AuthUser {
  userId: string
  userRole: string
}

/**
 * tsoa @Security 鉴权：securityName 为 `auth` 仅需登录，`admin` 需 admin 及以上。
 * API Key 代理路径已由 apiKeyAuth 中间件先设置 req.userId/req.userRole，直接复用。
 */
export async function expressAuthentication(request: Request, securityName: string, _scopes?: string[]): Promise<AuthUser> {
  const req = request as Request & { userId?: string, userRole?: string }
  let userId = req.userId
  let userRole = req.userRole

  if (!userId || !userRole) {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer '))
      throw new AppError(ErrCode.Unauthorized, 'missing or invalid authorization header')
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string, role: string }
      userId = payload.sub
      userRole = payload.role
    }
    catch {
      throw new AppError(ErrCode.Unauthorized, 'invalid or expired token')
    }
  }

  if (securityName === 'admin' && (ROLE_LEVEL[userRole] || 0) < (ROLE_LEVEL[SystemRole.Admin] || 0))
    throw new AppError(ErrCode.Forbidden, '没有权限')

  // 兼容现有 AuthRequest：控制器通过 req.userId / req.userRole 读取
  req.userId = userId
  req.userRole = userRole

  return { userId, userRole }
}
