import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'
import { resolveProject } from './project'

/** 获取项目源语言代码（原文统一由源语言语言值承载） */
async function getSourceLanguage(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } })
  return project?.sourceLanguage || ''
}

export interface BatchUpsertItem {
  /** 翻译 Key */
  translationKey: string
  /** 原文 */
  sourceText?: string
  /** 备注 */
  context?: string
  /** 标签 */
  tags?: string[]
  /** 语言代码 */
  languageCode: string
  /** 译文 */
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
  const sourceLang = await getSourceLanguage(projectId)
  // Always fetch all keys to keep rowIndex stable
  const keys = await prisma.translationKey.findMany({
    where: { projectId },
    include: { values: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })
  // 原文 = 源语言语言值
  const sourceByKey = new Map<string, string>()
  for (const k of keys)
    sourceByKey.set(k.id, k.values.find(v => v.languageCode === sourceLang)?.translatedText || '')

  let idx = 0
  const allItems = keys.map(k => ({
    key: k,
    rowIndex: ++idx,
    show: /* check if key should be included */ true,
  }))

  // 多个筛选条件同时生效：标签 / 搜索 / 仅未翻译 全部以 AND 组合
  let visible = allItems
  if (query.search || query.tags?.length || query.languageCode || query.untransOnly) {
    visible = allItems.filter((item) => {
      const k = item.key
      const sourceText = sourceByKey.get(k.id) || ''

      // 仅未翻译：指定语言下没有非空译文
      if (query.untransOnly && query.languageCode) {
        if (k.values.some(v => v.languageCode === query.languageCode && v.translatedText))
          return false
      }

      // 标签：命中任一选中标签
      if (query.tags?.length && !query.tags.some(t => k.tags?.includes(t)))
        return false

      // 搜索：匹配 key / 原文 / 译文 / 备注
      if (query.search) {
        const s = query.search
        let match = false
        if (s.startsWith('/') && s.endsWith('/') && s.length > 2) {
          try {
            const re = new RegExp(s.slice(1, -1), 'i')
            match = re.test(k.key) || re.test(sourceText) || k.values.some(v => re.test(v.translatedText)) || re.test(k.context || '')
          }
          catch {}
        }
        else {
          const low = s.toLowerCase()
          match = k.key.toLowerCase().includes(low) || sourceText.toLowerCase().includes(low) || k.values.some(v => v.translatedText.toLowerCase().includes(low)) || (k.context?.toLowerCase().includes(low) ?? false)
        }
        if (!match)
          return false
      }

      return true
    })
  }

  const total = visible.length
  const list = visible.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(item => ({
    rowIndex: item.rowIndex,
    sortOrder: item.key.sortOrder,
    translationKey: item.key.key,
    sourceText: sourceByKey.get(item.key.id) || '',
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
  sourceText?: string
  translatedText?: string
  context?: string
  tags?: string[]
}) {
  const sourceLang = await getSourceLanguage(projectId)
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: data.translationKey } } })
  if (!key) {
    key = await prisma.translationKey.create({
      data: { projectId, key: data.translationKey, context: data.context || '', tags: data.tags || [] },
    })
  }
  if (data.sourceText && sourceLang) {
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode: sourceLang } },
      update: { translatedText: data.sourceText },
      create: { keyId: key.id, languageCode: sourceLang, translatedText: data.sourceText },
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
}, createIfMissing = true) {
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: translationKey } } })
  if (!key) {
    if (!createIfMissing)
      throw new AppError(1003, 'Key not found')
    key = await prisma.translationKey.create({
      data: { projectId, key: translationKey, context: data.context || '', tags: data.tags || [] },
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

  await prisma.translationKey.update({ where: { id: existing.id }, data: { key: newKey } })

  // 原文写入源语言语言值
  if (sourceText !== undefined) {
    const sourceLang = await getSourceLanguage(projectId)
    if (sourceLang) {
      await prisma.translationValue.upsert({
        where: { keyId_languageCode: { keyId: existing.id, languageCode: sourceLang } },
        update: { translatedText: sourceText },
        create: { keyId: existing.id, languageCode: sourceLang, translatedText: sourceText },
      })
    }
  }
  return { oldKey, newKey, sourceText, count: 1 }
}

export async function deleteTranslation(id: string) {
  return prisma.translationKey.delete({ where: { id } })
}

export async function batchUpsert(projectId: string, items: BatchUpsertItem[]) {
  const sourceLang = await getSourceLanguage(projectId)
  for (const item of items) {
    let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: item.translationKey } } })
    if (!key) {
      key = await prisma.translationKey.create({
        data: { projectId, key: item.translationKey, context: item.context || '', tags: item.tags || [] },
      })
    }
    if (item.sourceText && sourceLang) {
      await prisma.translationValue.upsert({
        where: { keyId_languageCode: { keyId: key.id, languageCode: sourceLang } },
        update: { translatedText: item.sourceText },
        create: { keyId: key.id, languageCode: sourceLang, translatedText: item.sourceText },
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
