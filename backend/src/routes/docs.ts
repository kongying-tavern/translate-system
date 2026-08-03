import type { AuthRequest } from '../middleware/auth'
import { Router } from 'express'
import { success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { getApiKeyOpenApi } from '../services/docs'

export const docsRoutes = Router()

docsRoutes.get('/openapi', authMiddleware, (req: AuthRequest, res) => {
  success(res, getApiKeyOpenApi(req.userRole))
})
