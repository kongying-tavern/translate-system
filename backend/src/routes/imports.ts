import { Router } from 'express'
import { prisma } from '../index'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const importRoutes = Router()

importRoutes.get('/:projectSlug/imports/templates', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.findMany({ where: { projectId: req.params.projectSlug }, orderBy: { createdAt: 'desc' } })) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

importRoutes.post('/:projectSlug/imports/templates', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try {
    const { name, description, formatType, config } = req.body
    if (!name) return error(res, ErrCode.InvalidParams, 'name is required')
    success(res, await prisma.importTemplate.create({ data: { projectId: req.params.projectSlug, name, description: description || '', formatType: formatType || 'flat-json', config: config || {} } }))
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

importRoutes.get('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.findUnique({ where: { id: req.params.id } })) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

importRoutes.put('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { success(res, await prisma.importTemplate.update({ where: { id: req.params.id }, data: req.body })) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

importRoutes.delete('/:projectSlug/imports/templates/:id', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try { await prisma.importTemplate.delete({ where: { id: req.params.id } }); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// Execute import
importRoutes.post('/:projectSlug/imports/execute', authMiddleware as any, requireOwnership, async (req: any, res, next) => {
  try {
    const { templateId, languageCode, data, entriesOnly } = req.body
    const template = await prisma.importTemplate.findUnique({ where: { id: templateId } })
    if (!template) return error(res, ErrCode.NotFound, 'template not found')

    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    const entries = template.formatType === 'flat-json' || template.formatType === 'json'
      ? flatJSONParse(parsed, languageCode)
      : [] // CSV/Properties/XML parsing can be added later

    let count = 0
    for (const entry of entries) {
      const { key, translatedText, context, tags, sourceText } = entry
      let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId: req.params.projectSlug, key } } })
      if (!tk) {
        tk = await prisma.translationKey.create({ data: { projectId: req.params.projectSlug, key, sourceText: sourceText || key, context: context || '', tags: tags || [] } })
      } else {
        const updates: any = {}
        if (context !== undefined || tags?.length) {
          if (context !== undefined) updates.context = context
          if (tags?.length) updates.tags = tags
        }
        if (Object.keys(updates).length) await prisma.translationKey.update({ where: { id: tk.id }, data: updates })
      }
      if (!entriesOnly && translatedText !== undefined && languageCode) {
        await prisma.translationValue.upsert({
          where: { keyId_languageCode: { keyId: tk.id, languageCode } },
          update: { translatedText },
          create: { keyId: tk.id, languageCode, translatedText }
        })
      }
      count++
    }
    success(res, { imported: count })
  } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

function flatJSONParse(data: any, languageCode: string) {
  // data can be: { "key": "translation" } or { "zh-Hans": { "key": "translation" } }
  if (data[languageCode] && typeof data[languageCode] === 'object') {
    data = data[languageCode]
  }
  return Object.entries(data).map(([key, value]) => ({
    key, sourceText: key, translatedText: String(value), tags: [], context: ''
  }))
}
