import { Router } from 'express'
import * as exportService from '../services/export'
import * as transService from '../services/translation'
import * as langService from '../services/language'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const exportRoutes = Router()

exportRoutes.get('/:projectId/exports/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.listTemplates(req.params.projectId); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
exportRoutes.post('/:projectId/exports/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.createTemplate(req.params.projectId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.get('/:projectId/exports/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.getTemplate(req.params.templateId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.put('/:projectId/exports/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.updateTemplate(req.params.templateId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.delete('/:projectId/exports/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await exportService.deleteTemplate(req.params.templateId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

exportRoutes.post('/:projectId/exports/preview', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateId, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateId)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectId, languageCodes), langService.getLanguageDisplayMap(req.params.projectId)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

exportRoutes.post('/:projectId/exports/generate', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateId, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateId)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectId, languageCodes), langService.getLanguageDisplayMap(req.params.projectId)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
