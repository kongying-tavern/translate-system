import { Request, Response, NextFunction } from 'express'
import { error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  error(res, ErrCode.Internal, err.message || 'internal server error', 500)
}
