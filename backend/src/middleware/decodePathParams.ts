import type { NextFunction, Request, Response } from 'express'
import { decPathParam } from '../utils/path'

/** 统一解码 URL 路径参数（前端 encPathParam 对含 `/` 等特殊字符的值做了 URL-safe Base64 编码，带 `b64_` 前缀） */
export function decodePathParams(req: Request, _res: Response, next: NextFunction) {
  if (req.params) {
    for (const key of Object.keys(req.params)) {
      const v = req.params[key]
      if (typeof v === 'string' && v)
        req.params[key] = decPathParam(v)
    }
  }
  next()
}
