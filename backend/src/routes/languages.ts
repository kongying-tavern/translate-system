import { Router } from 'express'
import { ErrCode } from '../lib/errors'
import { error, success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import * as langService from '../services/language'
import { AppError } from '../utils/AppError'

export const languageRoutes = Router()

languageRoutes.get('/', authMiddleware, async (req, res) => {
  try {
    success(res, await langService.getBaseLanguages())
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

languageRoutes.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q as string
    if (!q)
      return error(res, ErrCode.InvalidParams, 'query q is required')
    success(res, await langService.searchBaseLanguages(q))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
