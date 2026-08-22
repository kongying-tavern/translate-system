import type { FieldErrors } from '@tsoa/runtime'
import type { NextFunction, Request, Response } from 'express'
import { ValidateError } from '@tsoa/runtime'
import { ErrCode } from '../lib/errors'
import { error } from '../lib/response'
import { AppError } from '../utils/AppError'

/** 将 tsoa 的英文校验信息转成中文可读提示，如「缺少必填参数：templateSlug、languageCodes」 */
function formatValidationError(fields: FieldErrors): string {
  const missing: string[] = []
  const others: string[] = []
  for (const [key, field] of Object.entries(fields)) {
    const fieldName = key.replace(/^(body\.|path\.|query\.)/, '')
    const msg = field.message || ''
    if (/is required/.test(msg))
      missing.push(fieldName)
    else
      others.push(`${fieldName} 参数校验失败：${msg}`)
  }
  const parts: string[] = []
  if (missing.length)
    parts.push(`缺少必填参数：${missing.join('、')}`)
  parts.push(...others)
  return parts.length ? parts.join('；') : '参数不合法'
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const bodyError = err as { type?: string }
  // 客户端中途断开（如上传被中止/页面关闭）：连接已关闭，无需响应，也不计为服务端异常
  if (bodyError.type === 'request.aborted')
    return
  if (err instanceof AppError) {
    // 业务错误沿用原响应（HTTP 200 + code），仅鉴权失败返回 401（前端依赖其触发 token 刷新）。
    // 均为预期路径（含 access token 每 15min 过期触发的常规 401），只记单行上下文，不打堆栈刷屏
    const status = err.code === ErrCode.Unauthorized ? 401 : 200
    console.warn(`[api] ${req.method} ${req.originalUrl} -> ${err.code} ${err.message}`)
    return error(res, err.code, err.message, status)
  }
  if (bodyError.type === 'entity.too.large') {
    console.warn(`[api] ${req.method} ${req.originalUrl} -> 1000 请求体过大`)
    return error(res, ErrCode.InvalidParams, '请求体过大：单次请求内容超出大小限制，请拆分后再试', 413)
  }
  if (bodyError.type === 'entity.parse.failed') {
    console.warn(`[api] ${req.method} ${req.originalUrl} -> 1000 非法 JSON`)
    return error(res, ErrCode.InvalidParams, '请求体不是合法 JSON', 400)
  }
  if (err instanceof ValidateError) {
    console.warn(`[api] ${req.method} ${req.originalUrl} -> 1000 ${formatValidationError(err.fields)}`)
    return error(res, ErrCode.InvalidParams, `参数校验失败：${formatValidationError(err.fields)}`)
  }
  // 只有真正的未预期异常才值得完整堆栈
  console.error(err)
  error(res, ErrCode.Internal, (err as { message?: string })?.message || 'internal server error', 500)
}
