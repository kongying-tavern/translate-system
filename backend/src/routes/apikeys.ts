import { Router } from 'express'
import { prisma } from '../index'
import crypto from 'crypto'
import { authMiddleware } from '../middleware/auth'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const apiKeyRoutes = Router()

// ── CRUD (JWT required) ──
apiKeyRoutes.get('/me/keys', authMiddleware, async (req: any, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, apiKey: true, enabled: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    success(res, keys)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

apiKeyRoutes.post('/me/keys', authMiddleware, async (req: any, res, next) => {
  try {
    const { name } = req.body
    if (!name) return error(res, ErrCode.InvalidParams, 'name is required')
    const apiKey = 'ak_' + crypto.randomBytes(16).toString('hex')
    const rawSecret = crypto.randomBytes(24).toString('hex')
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex')
    const k = await prisma.apiKey.create({ data: { userId: req.userId, name, apiKey, secret: secretHash } })
    success(res, { id: k.id, name: k.name, apiKey: k.apiKey, secret: rawSecret, createdAt: k.createdAt })
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

apiKeyRoutes.put('/me/keys/:id', authMiddleware, async (req: any, res, next) => {
  try {
    await prisma.apiKey.update({ where: { id: req.params.id, userId: req.userId }, data: { enabled: req.body.enabled } })
    success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

apiKeyRoutes.delete('/me/keys/:id', authMiddleware, async (req: any, res, next) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id, userId: req.userId } })
    success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
