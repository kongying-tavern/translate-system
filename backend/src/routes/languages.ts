import { Router } from 'express'
import * as langService from '../services/language'
import { authMiddleware } from '../middleware/auth'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const languageRoutes = Router()

languageRoutes.get('/', authMiddleware as any, async (req, res, next) => {
  try { success(res, await langService.getBaseLanguages()) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

languageRoutes.get('/search', authMiddleware as any, async (req, res, next) => {
  try {
    const q = req.query.q as string
    if (!q) return error(res, ErrCode.InvalidParams, 'query q is required')
    success(res, await langService.searchBaseLanguages(q))
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
