import type { Prisma } from '@prisma/client'
import type { AuthRequest } from '../middleware/auth'
import type { ImportEntry } from '../services/import/types'
import { Router } from 'express'
import { ProjectRole } from '../constants/roles'
import { prisma } from '../index'
import { ErrCode } from '../lib/errors'
import { ImportFormat } from '../lib/formats'
import { error, success } from '../lib/response'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership, requireProjectRole } from '../middleware/ownership'
import { csvParse } from '../services/import/csv'
import { JSONParse } from '../services/import/json'
import { propertiesParse } from '../services/import/properties'
import { xmlParse } from '../services/import/xml'
import { yamlParse } from '../services/import/yaml'
import { AppError } from '../utils/AppError'

export const importRoutes = Router()

function sniffFormat(raw: string): ImportFormat {
  const t = raw.trim()
  if (t.startsWith('{'))
    return ImportFormat.JSON
  if (t.startsWith('<'))
    return ImportFormat.XML
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  if (
    lines.some(l => l.trimStart().startsWith('---') || l.trimStart().startsWith('- '))
    || lines.some(l => /^\s+/.test(l))
    || lines.some(l => /^[\w.\-[/]+:\s/.test(l))
  ) {
    return ImportFormat.YAML
  }
  return ImportFormat.CSV
}

function parseImportData(raw: string, fmt: string): ImportEntry[] {
  try {
    if (fmt === ImportFormat.JSON)
      return JSONParse(raw)
    if (fmt === ImportFormat.CSV)
      return csvParse(raw)
    if (fmt === ImportFormat.Properties)
      return propertiesParse(raw)
    if (fmt === ImportFormat.YAML)
      return yamlParse(raw)
    if (fmt === ImportFormat.XML)
      return xmlParse(raw)
    return []
  }
  catch {
    return []
  }
}

async function importKeys(projectSlug: string, raw: string, fmt: ImportFormat, overwrite: boolean): Promise<{ imported: number, created: number, skipped: number }> {
  const entries = parseImportData(raw, fmt)
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, context, tags, sourceText } = entry
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId: projectSlug, key } } })
    const keyExisted = !!tk
    if (keyExisted && !overwrite) {
      skipped++
    }
    else {
      if (!tk) {
        const maxSo = await prisma.translationKey.aggregate({ where: { projectId: projectSlug }, _max: { sortOrder: true } })
        tk = await prisma.translationKey.create({ data: { projectId: projectSlug, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
      }
      if (context !== undefined || tags?.length) {
        const updates: Prisma.TranslationKeyUpdateInput = {}
        if (context !== undefined)
          updates.context = context
        if (tags?.length)
          updates.tags = tags
        if (Object.keys(updates).length)
          await prisma.translationKey.update({ where: { id: tk.id }, data: updates })
      }
      created++
    }
    imported++
  }
  return { imported, created, skipped }
}

async function importTranslations(projectSlug: string, raw: string, fmt: string, languageCode: string, overwrite: boolean, autoCreate: boolean): Promise<{ imported: number, created: number, skipped: number }> {
  const entries = parseImportData(raw, fmt)
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, translatedText, context, tags, sourceText, lang } = entry
    const langCode = lang || languageCode
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId: projectSlug, key } } })
    if (!tk && autoCreate !== false) {
      const maxSo = await prisma.translationKey.aggregate({ where: { projectId: projectSlug }, _max: { sortOrder: true } })
      tk = await prisma.translationKey.create({ data: { projectId: projectSlug, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
    }
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
    if (tk && translatedText !== undefined && langCode) {
      if (overwrite) {
        await prisma.translationValue.upsert({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } }, update: { translatedText }, create: { keyId: tk.id, languageCode: langCode, translatedText } })
        created++
      }
      else {
        const existing = await prisma.translationValue.findUnique({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } } })
        if (!existing || !existing.translatedText) {
          if (existing)
            await prisma.translationValue.update({ where: { id: existing.id }, data: { translatedText } })
          else
            await prisma.translationValue.create({ data: { keyId: tk.id, languageCode: langCode, translatedText } })
          created++
        }
        else {
          skipped++
        }
      }
    }
    imported++
  }
  return { imported, created, skipped }
}

importRoutes.post('/:projectSlug/imports/entries', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    const { data, overwrite } = req.body
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    success(res, await importKeys(req.params.projectSlug, raw, sniffFormat(raw), overwrite))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})

importRoutes.post('/:projectSlug/imports/translations', authMiddleware, requireOwnership, requireProjectRole(ProjectRole.Maintainer), async (req: AuthRequest, res) => {
  try {
    const { languageCode, formatType, data, overwrite, autoCreate } = req.body
    if (!formatType)
      return error(res, ErrCode.InvalidParams, 'formatType is required')
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    success(res, await importTranslations(req.params.projectSlug, raw, formatType as ImportFormat, languageCode, overwrite, autoCreate))
  }
  catch (e: unknown) { error(res, ErrCode.Internal, e instanceof AppError ? e.message : '') }
})
