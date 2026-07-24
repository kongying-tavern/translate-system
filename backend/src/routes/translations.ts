import { Router } from 'express'
import * as transService from '../services/translation'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, successWithPage, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const translationRoutes = Router()

// Grouped list - one row per key, all language translations embedded
translationRoutes.get('/:projectSlug/translations', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1'))
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string || '20'))
    const result = await transService.listGrouped(req.params.projectSlug, {
      languageCode: req.query.languageCode as string,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      untransOnly: req.query.untransOnly === 'true',
      page,
      pageSize,
    })
    successWithPage(res, result.list, result.total, page, pageSize)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

translationRoutes.post('/:projectSlug/translations', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const t = await transService.createTranslation(req.params.projectSlug, req.body)
    success(res, t)
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

// Update key and sourceText for all translations matching oldKey (MUST be before /:key/:langCode)
translationRoutes.put('/:projectSlug/translations/key/:oldKey', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const { translationKey, sourceText } = req.body
    if (!translationKey?.trim()) return error(res, ErrCode.InvalidParams, 'Key cannot be empty')
    const t = await transService.updateKeyAndSource(req.params.projectSlug, req.params.oldKey, translationKey.trim(), sourceText)
    success(res, t)
  } catch (e: any) { const status = e.code === ErrCode.Conflict ? 409 : 200; error(res, e.code || ErrCode.Internal, e.message, status) }
})

// Save translation for a specific key + language
translationRoutes.put('/:projectSlug/translations/:key/:langCode', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const t = await transService.saveForLang(req.params.projectSlug, req.params.key, req.params.langCode, req.body)
    success(res, t)
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

// All tags for a project
translationRoutes.get('/:projectSlug/translations/tags/list', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    const tags = await transService.getAllTags(req.params.projectSlug)
    success(res, tags)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

translationRoutes.delete('/:projectSlug/translations/:translationId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    await transService.deleteTranslation(req.params.translationId)
    success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

translationRoutes.post('/:projectSlug/translations/batch', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try {
    await transService.batchUpsert(req.params.projectSlug, req.body.translations)
    success(res, null)
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
