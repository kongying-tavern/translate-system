import type { Request } from 'express'

/** tsoa @Request() 注入的请求类型：expressAuthentication 鉴权后回写 userId/userRole */
export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
  projectRole?: string
}
