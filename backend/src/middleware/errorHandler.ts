import { Request, Response, NextFunction } from 'express'
import { error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  const e = err as { message?: string }
  error(res, ErrCode.Internal, e.message || 'internal server error', 500)
}
