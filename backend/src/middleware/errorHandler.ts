import type { NextFunction, Request, Response } from 'express'
import { ValidateError } from '@tsoa/runtime'
import { ErrCode } from '../lib/errors'
import { error } from '../lib/response'
import { AppError } from '../utils/AppError'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  if (err instanceof AppError) {
    // 业务错误沿用原响应（HTTP 200 + code），仅鉴权失败返回 401（前端依赖其触发 token 刷新）
    const status = err.code === ErrCode.Unauthorized ? 401 : 200
    return error(res, err.code, err.message, status)
  }
  if (err instanceof ValidateError) {
    const fields = err.fields || {}
    const message = Object.entries(fields)
      .map(([key, field]) => `${key}: ${field.message}`)
      .join('; ')
    return error(res, ErrCode.InvalidParams, `参数校验失败${message ? `: ${message}` : ''}`)
  }
  error(res, ErrCode.Internal, (err as { message?: string })?.message || 'internal server error', 500)
}
