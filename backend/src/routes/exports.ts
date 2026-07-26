import { Router } from 'express'
import { ErrCode } from '../lib/errors'
import { error, success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import * as exportService from '../services/export'
import * as langService from '../services/language'
import * as transService from '../services/translation'
import { AppError } from '../utils/AppError'

export const exportRoutes = Router()

exportRoutes.get('/:projectSlug/exports/templates', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const data = await exportService.listTemplates(req.params.projectSlug)
    success(res, data)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
exportRoutes.post('/:projectSlug/exports/templates', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const data = await exportService.createTemplate(req.params.projectSlug, req.body)
    success(res, data)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})
exportRoutes.get('/:projectSlug/exports/templates/:templateSlug', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const data = await exportService.getTemplate(req.params.templateSlug, req.params.projectSlug)
    success(res, data)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})
exportRoutes.put('/:projectSlug/exports/templates/:templateSlug', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const data = await exportService.updateTemplate(req.params.templateSlug, req.body)
    success(res, data)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})
exportRoutes.delete('/:projectSlug/exports/templates/:templateSlug', authMiddleware, requireOwnership, async (req, res) => {
  try {
    await exportService.deleteTemplate(req.params.templateSlug)
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

exportRoutes.post('/:projectSlug/exports/preview', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format, encoding] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as Record<string, unknown>, filterTags)
    success(res, { content, format, ...(encoding ? { encoding } : {}) })
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

exportRoutes.post('/:projectSlug/exports/generate', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const { templateSlug, languageCodes, filterTags } = req.body
    const t = await exportService.getTemplate(templateSlug, req.params.projectSlug)
    const [translations, aliases] = await Promise.all([transService.getForExport(req.params.projectSlug, languageCodes), langService.getLanguageDisplayMap(req.params.projectSlug)])
    const [content, format, encoding] = exportService.exportTranslations(translations, languageCodes, t.formatType, aliases, t.config as Record<string, unknown>, filterTags)
    success(res, { content, format, ...(encoding ? { encoding } : {}) })
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})
