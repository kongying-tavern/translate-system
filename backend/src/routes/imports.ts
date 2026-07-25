import { Router } from 'express'
import { prisma } from '../index'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'
import * as yaml from 'js-yaml'

export const importRoutes = Router()

importRoutes.get('/:projectSlug/imports/templates', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.findMany({ where: { projectId: req.params.projectSlug }, orderBy: { createdAt: 'desc' } })) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

importRoutes.post('/:projectSlug/imports/templates', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try {
    const { name, description, formatType, config } = req.body
    if (!name) return error(res, ErrCode.InvalidParams, 'name is required')
    success(res, await prisma.importTemplate.create({ data: { projectId: req.params.projectSlug, name, description: description || '', formatType: formatType || 'flat-json', config: config || {} } }))
  } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

importRoutes.get('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.findUnique({ where: { id: req.params.id } })) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

importRoutes.put('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.update({ where: { id: req.params.id }, data: req.body })) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

importRoutes.delete('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { await prisma.importTemplate.delete({ where: { id: req.params.id } }); success(res, null) } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

// Execute import (supports both template-based and direct mode)
importRoutes.post('/:projectSlug/imports/execute', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try {
    const { templateId, languageCode, data, entriesOnly, overwrite, autoCreate } = req.body
    console.log('[import] entriesOnly:', entriesOnly, 'overwrite:', overwrite, 'autoCreate:', autoCreate, 'lang:', languageCode)
    const raw = typeof data === 'string' ? data : JSON.stringify(data)

    // Resolve format and entriesOnly
    let fmt = req.body.formatType || 'flat-json'
    let eOnly = entriesOnly
    if (templateId) {
      const template = await prisma.importTemplate.findUnique({ where: { id: templateId } })
      if (!template) return error(res, ErrCode.NotFound, 'template not found')
      fmt = template.formatType
      eOnly = template.formatType === 'entries-only'
    }

    // Parse
    let entries: any[] = []
    if (eOnly) {
      if (raw.trim().startsWith('{')) entries = flatJSONParse(JSON.parse(raw), languageCode)
      else if (raw.trim().startsWith('<')) entries = xmlParse(raw)
      else if (raw.includes(':') && !raw.includes(',')) entries = yamlParse(raw)
      else entries = csvParse(raw)
    } else if (fmt === 'flat-json' || fmt === 'json') entries = flatJSONParse(JSON.parse(raw), languageCode)
    else if (fmt === 'csv') entries = csvParse(raw)
    else if (fmt === 'properties') entries = propertiesParse(raw)
    else if (fmt === 'yaml') entries = yamlParse(raw)
    else if (fmt === 'xml') entries = xmlParse(raw)

    let count = 0, created = 0, skipped = 0
    for (const entry of entries) {
      const { key, translatedText, context, tags, sourceText, lang } = entry
      const langCode = lang || languageCode
      let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId: req.params.projectSlug, key } } })
      const keyExisted = !!tk
      if (!tk && autoCreate !== false) {
        const maxSo = await prisma.translationKey.aggregate({ where: { projectId: req.params.projectSlug }, _max: { sortOrder: true } })
        tk = await prisma.translationKey.create({ data: { projectId: req.params.projectSlug, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
      }
      if (eOnly && keyExisted && !overwrite) skipped++
      if (tk) {
        if (context !== undefined || tags?.length) {
          const updates: any = {}
          if (context !== undefined) updates.context = context
          if (tags?.length) updates.tags = tags
          if (Object.keys(updates).length) await prisma.translationKey.update({ where: { id: tk.id }, data: updates })
        }
      }
      if (!eOnly && tk && translatedText !== undefined && langCode) {
        if (overwrite) {
          await prisma.translationValue.upsert({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } }, update: { translatedText }, create: { keyId: tk.id, languageCode: langCode, translatedText } })
          created++
        } else {
          const existing = await prisma.translationValue.findUnique({ where: { keyId_languageCode: { keyId: tk.id, languageCode: langCode } } })
          if (!existing || !existing.translatedText) {
            if (existing) { await prisma.translationValue.update({ where: { id: existing.id }, data: { translatedText } }) }
            else { await prisma.translationValue.create({ data: { keyId: tk.id, languageCode: langCode, translatedText } }) }
            created++
          } else { skipped++ }
        }
      }
      count++
    }
    success(res, { imported: count, created, skipped })
  } catch (e: unknown) { error(res, ErrCode.Internal, (e as { message?: string }).message || '') }
})

function flatJSONParse(data: any, languageCode: string) {
  // Detect nested: { "zh-Hans": { "key": "val" } } → flatten with lang
  const firstVal = Object.values(data)[0]
  if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal) && !firstVal.translatedText && !firstVal.sourceText) {
    const entries: any[] = []
    for (const [lang, obj] of Object.entries(data)) {
      if (!obj || typeof obj !== 'object') continue
      for (const [k, v] of Object.entries(obj as any)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          entries.push({ key: k, sourceText: v.sourceText || k, translatedText: v.translatedText || '', tags: v.tags || [], context: v.context || '', lang })
        } else {
          entries.push({ key: k, sourceText: k, translatedText: String(v || ''), tags: [], context: '', lang })
        }
      }
    }
    return entries
  }
  // Flat: { "key": "val" } or { "key": { sourceText, tags, ... } }
  return Object.entries(data).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { key, sourceText: value.sourceText || key, translatedText: value.translatedText || '', tags: value.tags || [], context: value.context || '' }
    }
    return { key, sourceText: key, translatedText: String(value || ''), tags: [], context: '' }
  })
}

function csvParse(data: string) {
  const lines = data.split('\n').filter(l => l.trim())
  if (!lines.length) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const entries: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    const entry: any = { tags: [], context: '' }
    headers.forEach((h, idx) => {
      if (h === 'key') entry.key = vals[idx]
      else if (h === 'sourcetext' || h === 'source_text') entry.sourceText = vals[idx]
      else if (h === 'translatedtext' || h === 'translated_text') entry.translatedText = vals[idx]
      else if (h === 'tags' && vals[idx]) entry.tags = vals[idx].split(';').map((t: string) => t.trim())
      else if (h === 'context') entry.context = vals[idx]
    })
    if (entry.key) { entry.sourceText = entry.sourceText || entry.key; entries.push(entry) }
  }
  return entries
}

function yamlParse(data: string) {
  const parsed: any = yaml.load(data)
  if (!parsed || typeof parsed !== 'object') return []
  // Check if nested: { "zh-Hans": { "key": "val" }, "en-US": { "key": "val" } }
  const firstVal = Object.values(parsed)[0]
  if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
    const entries: any[] = []
    for (const [lang, obj] of Object.entries(parsed)) {
      for (const [key, value] of Object.entries(obj as any)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          entries.push({ key, sourceText: (value as any).sourceText || key, translatedText: (value as any).translatedText || '', tags: (value as any).tags || [], context: (value as any).context || '', lang })
        } else {
          entries.push({ key, sourceText: key, translatedText: String(value || ''), tags: [], context: '', lang })
        }
      }
    }
    return entries
  }
  // Flat: { "key": "val" }
  return Object.entries(parsed).map(([key, value]: [string, any]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { key, sourceText: value.sourceText || key, translatedText: value.translatedText || '', tags: value.tags || [], context: value.context || '' }
    }
    return { key, sourceText: key, translatedText: String(value || ''), tags: [], context: '' }
  })
}

function propertiesParse(data: string) {
  const entries: any[] = []
  for (const line of data.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('!')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    entries.push({ key: t.substring(0, eq).trim(), sourceText: t.substring(0, eq).trim(), translatedText: t.substring(eq + 1).trim(), tags: [], context: '' })
  }
  return entries
}

function xmlParse(data: string) {
  const entries: any[] = []
  const langRe = /<language\s+code="([^"]*)"[^>]*>([\s\S]*?)<\/language>/g
  let lm
  while ((lm = langRe.exec(data))) {
    const langCode = lm[1]
    const strRe = /<string\s+name="([^"]*)"(\s+sourceText="([^"]*)")?(\s+tags="([^"]*)")?(\s+context="([^"]*)")?[^>]*>([\s\S]*?)<\/string>/g
    let sm; while ((sm = strRe.exec(lm[2]))) entries.push({ key: sm[1], sourceText: sm[3] || sm[1], translatedText: sm[8].trim(), tags: sm[5] ? sm[5].split(';').map((t: string) => t.trim()) : [], context: sm[7] || '', lang: langCode })
  }
  if (!entries.length) {
    const re = /<string\s+name="([^"]*)"(\s+sourceText="([^"]*)")?(\s+tags="([^"]*)")?(\s+context="([^"]*)")?[^>]*>([\s\S]*?)<\/string>/g
    let m; while ((m = re.exec(data))) entries.push({ key: m[1], sourceText: m[3] || m[1], translatedText: m[8].trim(), tags: m[5] ? m[5].split(';').map((t: string) => t.trim()) : [], context: m[7] || '' })
  }
  return entries
}

function parseCSVLine(line: string) {
  const r: string[] = []; let c = '', q = false
  for (const ch of line) {
    if (q) { if (ch === '"') q = false; else c += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { r.push(c.trim()); c = '' }
    else c += ch
  }
  r.push(c.trim()); return r
}
