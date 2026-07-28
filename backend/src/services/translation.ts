import type { Prisma } from '@prisma/client'
import { prisma } from '../index'
import { AppError } from '../utils/AppError'
import { resolveProject } from './project'

export interface BatchUpsertItem {
  translationKey: string
  sourceText?: string
  context?: string
  tags?: string[]
  languageCode: string
  translatedText?: string
}

export async function listGrouped(projectId: string, query: {
  languageCode?: string
  search?: string
  tags?: string[]
  untransOnly?: boolean
  page: number
  pageSize: number
}) {
  // Always fetch all keys to keep rowIndex stable
  const keys = await prisma.translationKey.findMany({
    where: { projectId },
    include: { values: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })

  let idx = 0
  const allItems = keys.map(k => ({
    key: k,
    rowIndex: ++idx,
    show: /* check if key should be included */ true,
  }))

  // Apply original filter logic
  let visible = allItems
  if (query.search || query.tags?.length || query.languageCode || query.untransOnly) {
    visible = allItems.filter((item) => {
      const k = item.key
      if (query.languageCode && !query.untransOnly && !query.search)
        return k.values.length > 0
      if (query.untransOnly && query.languageCode)
        return !k.values.some(v => v.languageCode === query.languageCode && v.translatedText)
      if (query.tags?.length)
        return query.tags.some(t => k.tags?.includes(t))
      if (query.search) {
        const s = query.search
        if (s.startsWith('/') && s.endsWith('/') && s.length > 2) {
          try {
            const re = new RegExp(s.slice(1, -1), 'i')
            return re.test(k.key) || re.test(k.sourceText) || k.values.some(v => re.test(v.translatedText)) || re.test(k.context || '')
          }
          catch {}
        }
        return k.key.toLowerCase().includes(s.toLowerCase()) || k.sourceText.toLowerCase().includes(s.toLowerCase()) || k.values.some(v => v.translatedText.toLowerCase().includes(s.toLowerCase())) || k.context?.toLowerCase().includes(s.toLowerCase())
      }
      return true
    })
  }
  if (query.languageCode && !query.search && !query.untransOnly) {
    visible = visible.filter(item => item.key.values.length > 0)
  }

  const total = visible.length
  const list = visible.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(item => ({
    rowIndex: item.rowIndex,
    sortOrder: item.key.sortOrder,
    translationKey: item.key.key,
    sourceText: item.key.sourceText,
    context: item.key.context || '',
    tags: item.key.tags,
    keyId: item.key.id,
    translations: Object.fromEntries(item.key.values.map(v => [v.languageCode, {
      id: v.id,
      translatedText: v.translatedText,
      isReviewed: v.isReviewed,
      reviewerComment: v.reviewerComment,
    }])),
  }))

  return { list, total }
}

export async function createTranslation(projectId: string, data: {
  translationKey: string
  languageCode: string
  sourceText: string
  translatedText?: string
  context?: string
  tags?: string[]
}) {
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: data.translationKey } } })
  if (!key) {
    key = await prisma.translationKey.create({
      data: { projectId, key: data.translationKey, sourceText: data.sourceText, context: data.context || '', tags: data.tags || [] },
    })
  }
  const val = await prisma.translationValue.upsert({
    where: { keyId_languageCode: { keyId: key.id, languageCode: data.languageCode } },
    update: { translatedText: data.translatedText || '' },
    create: { keyId: key.id, languageCode: data.languageCode, translatedText: data.translatedText || '' },
  })
  return { ...key, value: val }
}

export async function saveForLang(projectId: string, translationKey: string, languageCode: string, data: {
  translatedText?: string
  tags?: string[]
  context?: string
}) {
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: translationKey } } })
  if (!key) {
    key = await prisma.translationKey.create({
      data: { projectId, key: translationKey, sourceText: translationKey, context: data.context || '', tags: data.tags || [] },
    })
  }
  else if (data.tags !== undefined || data.context !== undefined) {
    const updateData: Prisma.TranslationKeyUpdateInput = {}
    if (data.tags !== undefined)
      updateData.tags = data.tags
    if (data.context !== undefined)
      updateData.context = data.context
    await prisma.translationKey.update({ where: { id: key.id }, data: updateData })
  }

  if (data.translatedText !== undefined) {
    return prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode } },
      update: { translatedText: data.translatedText },
      create: { keyId: key.id, languageCode, translatedText: data.translatedText },
    })
  }
  return key
}

export async function updateKeyAndSource(projectId: string, oldKey: string, newKey: string, sourceText?: string) {
  const existing = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: oldKey } } })
  if (!existing)
    throw new AppError(1003, 'Key not found')

  if (oldKey !== newKey) {
    const dup = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: newKey } } })
    if (dup)
      throw new AppError(1004, 'Key 已存在，不能重复')
  }

  const updateData: Prisma.TranslationKeyUpdateInput = { key: newKey }
  if (sourceText !== undefined)
    updateData.sourceText = sourceText

  await prisma.translationKey.update({ where: { id: existing.id }, data: updateData })
  return { oldKey, newKey, sourceText, count: 1 }
}

export async function deleteTranslation(id: string) {
  return prisma.translationKey.delete({ where: { id } })
}

export async function batchUpsert(projectId: string, items: BatchUpsertItem[]) {
  for (const item of items) {
    let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: item.translationKey } } })
    if (!key) {
      key = await prisma.translationKey.create({
        data: { projectId, key: item.translationKey, sourceText: item.sourceText || '', context: item.context || '', tags: item.tags || [] },
      })
    }
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode: item.languageCode } },
      update: { translatedText: item.translatedText || '' },
      create: { keyId: key.id, languageCode: item.languageCode, translatedText: item.translatedText || '' },
    })
  }
}

export async function getForExport(projectId: string, _languageCodes: string[]): Promise<Prisma.TranslationKeyGetPayload<{ include: { values: true } }>[]> {
  const keys = await prisma.translationKey.findMany({
    where: { projectId },
    include: { values: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })
  return keys
}

export async function getTranslationCount(projectSlug: string, languageCode?: string, tags?: string[]) {
  const project = await resolveProject(projectSlug)
  if (!project)
    throw new AppError(404, 'project not found')

  const keyWhere: Prisma.TranslationKeyWhereInput = { projectId: project.id }
  if (tags?.length)
    keyWhere.tags = { hasSome: tags }

  const total = await prisma.translationKey.count({ where: keyWhere })
  if (!languageCode)
    return { total, translated: 0, languageCode: '*' }
  const translated = await prisma.translationValue.count({
    where: { key: keyWhere, languageCode, translatedText: { not: '' } },
  })
  return { total, translated, languageCode }
}

export async function getAllTags(projectId: string) {
  const keys = await prisma.translationKey.findMany({ where: { projectId }, select: { tags: true } })
  const tags = new Set<string>()
  for (const k of keys) {
    for (const t of k.tags) tags.add(t)
  }
  return Array.from(tags)
}
