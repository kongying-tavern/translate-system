import { Router } from 'express'
import { prisma } from '../index'
import crypto from 'crypto'
import { authMiddleware } from '../middleware/auth'
import { apiKeyAuth } from '../middleware/apikey'
import { requireOwnership } from '../middleware/ownership'
import * as exportService from '../services/export'
import * as transService from '../services/translation'
import * as langService from '../services/language'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const apiKeyRoutes = Router()

// ── Managed API keys (user token required) ──
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

// ── Export via API Key ──
apiKeyRoutes.post('/export/preview/:projectId', apiKeyAuth(), async (req: any, res, next) => {
  try {
    const { templateId, languageCodes, filterTags } = req.body
    // Check project access
    const canAccess = await prisma.project.count({ where: { id: req.params.projectId, userId: req.userId } }) > 0 ||
      await prisma.projectMember.count({ where: { projectId: req.params.projectId, userId: req.userId } }) > 0
    if (!canAccess) return error(res, ErrCode.Forbidden, 'no access to this project')
    const t = await exportService.getTemplate(templateId)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectId, languageCodes), langService.getLanguageDisplayMap(req.params.projectId)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

apiKeyRoutes.post('/export/generate/:projectId', apiKeyAuth(), async (req: any, res, next) => {
  try {
    const { templateId, languageCodes, filterTags } = req.body
    const canAccess = await prisma.project.count({ where: { id: req.params.projectId, userId: req.userId } }) > 0 ||
      await prisma.projectMember.count({ where: { projectId: req.params.projectId, userId: req.userId } }) > 0
    if (!canAccess) return error(res, ErrCode.Forbidden, 'no access to this project')
    const t = await exportService.getTemplate(templateId)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectId, languageCodes), langService.getLanguageDisplayMap(req.params.projectId)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
