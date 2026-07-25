import { Router } from 'express'
import * as langService from '../services/language'
import { authMiddleware } from '../middleware/auth'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const languageRoutes = Router()

languageRoutes.get('/', authMiddleware, async (req, res, next) => {
  try { success(res, await langService.getBaseLanguages()) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

languageRoutes.get('/search', authMiddleware, async (req, res, next) => {
  try {
    const q = req.query.q as string
    if (!q) return error(res, ErrCode.InvalidParams, 'query q is required')
    success(res, await langService.searchBaseLanguages(q))
  } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})
