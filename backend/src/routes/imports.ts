import type { Prisma } from '@prisma/client'
import type { AuthRequest } from '../middleware/auth'
import type { ImportEntry } from '../services/import/types'
import { Router } from 'express'
import { prisma } from '../index'
import { ErrCode } from '../lib/errors'
import { error, success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { csvParse } from '../services/import/csv'
import { JSONParse } from '../services/import/json'
import { propertiesParse } from '../services/import/properties'
import { xmlParse } from '../services/import/xml'
import { yamlParse } from '../services/import/yaml'
import { AppError } from '../utils/AppError'

export const importRoutes = Router()

importRoutes.get('/:projectSlug/imports/templates', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    success(res, await prisma.importTemplate.findMany({ where: { projectId: req.params.projectSlug }, orderBy: { createdAt: 'desc' } }))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

importRoutes.post('/:projectSlug/imports/templates', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    const { name, description, formatType, config } = req.body
    if (!name)
      return error(res, ErrCode.InvalidParams, 'name is required')
    success(res, await prisma.importTemplate.create({ data: { projectId: req.params.projectSlug, name, description: description || '', formatType: formatType || 'flat-json', config: config || {} } }))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

importRoutes.get('/:projectSlug/imports/templates/:id', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    success(res, await prisma.importTemplate.findUnique({ where: { id: req.params.id } }))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

importRoutes.put('/:projectSlug/imports/templates/:id', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    success(res, await prisma.importTemplate.update({ where: { id: req.params.id }, data: req.body }))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

importRoutes.delete('/:projectSlug/imports/templates/:id', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    await prisma.importTemplate.delete({ where: { id: req.params.id } })
    success(res, null)
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

// Execute import (supports both template-based and direct mode)
importRoutes.post('/:projectSlug/imports/execute', authMiddleware, requireOwnership, async (req: AuthRequest, res) => {
  try {
    const { templateId, languageCode, data, entriesOnly, overwrite, autoCreate } = req.body
    // eslint-disable-next-line no-console
    console.log('[import] entriesOnly:', entriesOnly, 'overwrite:', overwrite, 'autoCreate:', autoCreate, 'lang:', languageCode)
    const raw = typeof data === 'string' ? data : JSON.stringify(data)

    // Resolve format and entriesOnly
    let fmt = req.body.formatType || 'flat-json'
    let eOnly = entriesOnly
    if (templateId) {
      const template = await prisma.importTemplate.findUnique({ where: { id: templateId } })
      if (!template)
        return error(res, ErrCode.NotFound, 'template not found')
      fmt = template.formatType
      eOnly = template.formatType === 'entries-only'
    }

    // Parse
    let entries: ImportEntry[] = []
    if (eOnly) {
      if (raw.trim().startsWith('{'))
        entries = JSONParse(JSON.parse(raw), languageCode)
      else if (raw.trim().startsWith('<'))
        entries = xmlParse(raw)
      else if (raw.includes(':') && !raw.includes(','))
        entries = yamlParse(raw)
      else entries = csvParse(raw)
    }
    else if (fmt === 'flat-json' || fmt === 'json') {
      entries = JSONParse(JSON.parse(raw), languageCode)
    }
    else if (fmt === 'csv') {
      entries = csvParse(raw)
    }
    else if (fmt === 'properties') {
      entries = propertiesParse(raw)
    }
    else if (fmt === 'yaml') {
      entries = yamlParse(raw)
    }
    else if (fmt === 'xml') {
      entries = xmlParse(raw)
    }

    let count = 0
    let created = 0
    let skipped = 0
    for (const entry of entries) {
      const { key, translatedText, context, tags, sourceText, lang } = entry
      const langCode = lang || languageCode
      let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId: req.params.projectSlug, key } } })
      const keyExisted = !!tk
      if (!tk && autoCreate !== false) {
        const maxSo = await prisma.translationKey.aggregate({ where: { projectId: req.params.projectSlug }, _max: { sortOrder: true } })
        tk = await prisma.translationKey.create({ data: { projectId: req.params.projectSlug, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
      }
      if (eOnly && keyExisted && !overwrite)
        skipped++
      if (tk) {
        if (context !== undefined || tags?.length) {
          const updates: Prisma.TranslationKeyUpdateInput = {}
          if (context !== undefined)
            updates.context = context
          if (tags?.length)
            updates.tags = tags
          if (Object.keys(updates).length)
            await prisma.translationKey.update({ where: { id: tk.id }, data: updates })
        }
      }
      if (!eOnly && tk && translatedText !== undefined && langCode) {
        if (overwrite) {
          await prisma.translationValue.upsert({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } }, update: { translatedText }, create: { keyId: tk.id, languageCode: langCode, translatedText } })
          created++
        }
        else {
          const existing = await prisma.translationValue.findUnique({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } } })
          if (!existing || !existing.translatedText) {
            if (existing) {
              await prisma.translationValue.update({ where: { id: existing.id }, data: { translatedText } })
            }
            else { await prisma.translationValue.create({ data: { keyId: tk.id, languageCode: langCode, translatedText } }) }
            created++
          }
          else { skipped++ }
        }
      }
      count++
    }
    success(res, { imported: count, created, skipped })
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
