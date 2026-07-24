import { Router } from 'express'
import * as exportService from '../services/export'
import * as transService from '../services/translation'
import * as langService from '../services/language'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const exportRoutes = Router()

exportRoutes.get('/:projectSlug/exports/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.listTemplates(req.params.projectSlug); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
exportRoutes.post('/:projectSlug/exports/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.createTemplate(req.params.projectSlug, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.get('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.getTemplate(req.params.templateSlug, req.params.projectSlug); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.put('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.updateTemplate(req.params.templateSlug, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
exportRoutes.delete('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await exportService.deleteTemplate(req.params.templateSlug); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

exportRoutes.post('/:projectSlug/exports/preview', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

exportRoutes.post('/:projectSlug/exports/generate', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as any, filterTags)
    success(res, { content, format })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
