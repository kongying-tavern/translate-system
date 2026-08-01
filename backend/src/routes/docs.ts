import { Router } from 'express'
import { success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { getApiKeyOpenApi } from '../services/docs'

export const docsRoutes = Router()

docsRoutes.get('/openapi', authMiddleware, (_req, res) => {
  success(res, getApiKeyOpenApi())
})
