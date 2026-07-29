import type { AuthRequest } from '../middleware/auth'
import { Router } from 'express'
import { ProjectRole } from '../constants/roles'
import { prisma } from '../index'
import { ErrCode } from '../lib/errors'
import { error, success, successWithPage } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership, requireProjectRole } from '../middleware/ownership'
import * as transService from '../services/translation'
import { AppError } from '../utils/AppError'

export const translationRoutes = Router()

// Grouped list - one row per key, all language translations embedded
translationRoutes.get('/:projectSlug/translations', authMiddleware, requireOwnership, async (req, res) => {
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
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

translationRoutes.post('/:projectSlug/translations', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req, res) => {
  try {
    const t = await transService.createTranslation(req.params.projectSlug, req.body)
    success(res, t)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

// Update key and sourceText for all translations matching oldKey (MUST be before /:key/:langCode)
translationRoutes.put('/:projectSlug/translations/key/:oldKey', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req, res) => {
  try {
    const { translationKey, sourceText } = req.body
    if (!translationKey?.trim())
      return error(res, ErrCode.InvalidParams, 'Key cannot be empty')
    const t = await transService.updateKeyAndSource(req.params.projectSlug, req.params.oldKey, translationKey.trim(), sourceText)
    success(res, t)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    const status = err.code === ErrCode.Conflict ? 409 : 200
    error(res, err.code, err.message, status)
  }
})

// Save translation for a specific key + language (langCode optional for key-level updates)
translationRoutes.put('/:projectSlug/translations/:key/:langCode?', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const t = await transService.saveForLang(req.params.projectSlug, req.params.key, req.params.langCode, req.body)
    success(res, t)
  }
  catch (e: unknown) {
    const err = e instanceof AppError ? e : { code: ErrCode.Internal, message: '' }
    error(res, err.code, err.message)
  }
})

// Translation count (lightweight)
translationRoutes.get('/:projectSlug/translations/count', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined
    const data = await transService.getTranslationCount(req.params.projectSlug, req.query.languageCode as string, tags)
    success(res, data)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

// All tags for a project
translationRoutes.get('/:projectSlug/translations/tags/list', authMiddleware, requireOwnership, async (req, res) => {
  try {
    const tags = await transService.getAllTags(req.params.projectSlug)
    success(res, tags)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

translationRoutes.delete('/:projectSlug/translations/:translationId', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req, res) => {
  try {
    await transService.deleteTranslation(req.params.translationId)
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

translationRoutes.put('/:projectSlug/translations/sortOrders', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    for (const o of req.body.orders) {
      await prisma.translationKey.update({ where: { id: o.keyId }, data: { sortOrder: o.sortOrder } })
    }
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

translationRoutes.post('/:projectSlug/translations/batch', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req, res) => {
  try {
    await transService.batchUpsert(req.params.projectSlug, req.body.translations)
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
