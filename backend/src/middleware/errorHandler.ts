import type { NextFunction, Request, Response } from 'express'
import { ErrCode } from '../lib/errors'
import { error } from '../lib/response'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  const e = err as { message?: string }
  error(res, ErrCode.Internal, e.message || 'internal server error', 500)
}
