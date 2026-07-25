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
  try { const data = await exportService.listTemplates(req.params.projectSlug); success(res, data) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})
exportRoutes.post('/:projectSlug/exports/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.createTemplate(req.params.projectSlug, req.body); success(res, data) } catch (e: unknown) { const err = e as { code?: number; message?: string }; error(res, err.code || ErrCode.Internal, err.message || '') }
})
exportRoutes.get('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.getTemplate(req.params.templateSlug, req.params.projectSlug); success(res, data) } catch (e: unknown) { const err = e as { code?: number; message?: string }; error(res, err.code || ErrCode.Internal, err.message || '') }
})
exportRoutes.put('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await exportService.updateTemplate(req.params.templateSlug, req.body); success(res, data) } catch (e: unknown) { const err = e as { code?: number; message?: string }; error(res, err.code || ErrCode.Internal, err.message || '') }
})
exportRoutes.delete('/:projectSlug/exports/templates/:templateSlug', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await exportService.deleteTemplate(req.params.templateSlug); success(res, null) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

exportRoutes.post('/:projectSlug/exports/preview', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format, encoding] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as Record<string, unknown>, filterTags)
    success(res, { content, format, ...(encoding ? { encoding } : {}) })
  } catch (e: unknown) { const err = e as { code?: number; message?: string }; error(res, err.code || ErrCode.Internal, err.message || '') }
})

exportRoutes.post('/:projectSlug/exports/generate', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format, encoding] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as Record<string, unknown>, filterTags)
    success(res, { content, format, ...(encoding ? { encoding } : {}) })
  } catch (e: unknown) { const err = e as { code?: number; message?: string }; error(res, err.code || ErrCode.Internal, err.message || '') }
})
