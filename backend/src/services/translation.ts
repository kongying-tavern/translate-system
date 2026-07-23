import { prisma } from '../index'

export async function listGrouped(projectId: string, query: {
  languageCode?: string; search?: string; tags?: string[]; untransOnly?: boolean; page: number; pageSize: number;
}) {
  const whereKey: any = { projectId }
  const whereVal: any = {}
  if (query.languageCode) whereVal.languageCode = query.languageCode
  if (query.search) {
    whereKey.OR = [
      { key: { contains: query.search, mode: 'insensitive' } },
      { sourceText: { contains: query.search, mode: 'insensitive' } },
      { context: { contains: query.search, mode: 'insensitive' } },
    ]
    whereVal.translatedText = { contains: query.search, mode: 'insensitive' }
  }
  if (query.tags?.length) whereKey.tags = { hasSome: query.tags }

  const keys = await prisma.translationKey.findMany({
    where: whereKey,
    include: { values: { where: Object.keys(whereVal).length ? whereVal : undefined } },
    orderBy: { key: 'asc' },
  })

  // Search in values too and filter
  let filtered = keys.filter(k => k.values.length > 0 || !query.languageCode)
  if (query.search && !whereKey.OR) {
    // search only in values
    filtered = keys.filter(k => k.values.some(v => v.translatedText.toLowerCase().includes(query.search!.toLowerCase())))
  }
  if (query.untransOnly && query.languageCode) {
    filtered = filtered.filter(k => !k.values.some(v => v.languageCode === query.languageCode && v.translatedText))
  } else if (query.languageCode && !query.search) {
    filtered = keys.filter(k => k.values.length > 0)
  }

  const total = filtered.length
  const list = filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(k => ({
    translationKey: k.key,
    sourceText: k.sourceText,
    context: k.context || '',
    tags: k.tags,
    keyId: k.id,
    translations: Object.fromEntries(k.values.map(v => [v.languageCode, {
      id: v.id,
      translatedText: v.translatedText,
      isReviewed: v.isReviewed,
      reviewerComment: v.reviewerComment,
    }])),
  }))

  return { list, total }
}

export async function createTranslation(projectId: string, data: {
  translationKey: string; languageCode: string; sourceText: string;
  translatedText?: string; context?: string; tags?: string[];
}) {
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: data.translationKey } } })
  if (!key) {
    key = await prisma.translationKey.create({
      data: { projectId, key: data.translationKey, sourceText: data.sourceText, context: data.context || '', tags: data.tags || [] }
    })
  }
  const val = await prisma.translationValue.upsert({
    where: { keyId_languageCode: { keyId: key.id, languageCode: data.languageCode } },
    update: { translatedText: data.translatedText || '' },
    create: { keyId: key.id, languageCode: data.languageCode, translatedText: data.translatedText || '' }
  })
  return { ...key, value: val }
}

export async function saveForLang(projectId: string, translationKey: string, languageCode: string, data: {
  translatedText?: string; tags?: string[]; context?: string;
}) {
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: translationKey } } })
  if (!key) {
    key = await prisma.translationKey.create({
      data: { projectId, key: translationKey, sourceText: translationKey, context: data.context || '', tags: data.tags || [] }
    })
  } else if (data.tags !== undefined || data.context !== undefined) {
    const updateData: any = {}
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.context !== undefined) updateData.context = data.context
    await prisma.translationKey.update({ where: { id: key.id }, data: updateData })
  }

  if (data.translatedText !== undefined) {
    return prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode } },
      update: { translatedText: data.translatedText },
      create: { keyId: key.id, languageCode, translatedText: data.translatedText }
    })
  }
  return key
}

export async function updateKeyAndSource(projectId: string, oldKey: string, newKey: string, sourceText?: string) {
  const existing = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: oldKey } } })
  if (!existing) throw { code: 1003, message: 'Key not found' }

  if (oldKey !== newKey) {
    const dup = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: newKey } } })
    if (dup) throw { code: 1004, message: 'Key 已存在，不能重复' }
  }

  const updateData: any = { key: newKey }
  if (sourceText !== undefined) updateData.sourceText = sourceText

  await prisma.translationKey.update({ where: { id: existing.id }, data: updateData })
  return { oldKey, newKey, sourceText, count: 1 }
}

export async function deleteTranslation(id: string) {
  return prisma.translationKey.delete({ where: { id } })
}

export async function batchUpsert(projectId: string, items: any[]) {
  for (const item of items) {
    let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: item.translationKey } } })
    if (!key) {
      key = await prisma.translationKey.create({
        data: { projectId, key: item.translationKey, sourceText: item.sourceText, context: item.context || '', tags: item.tags || [] }
      })
    }
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode: item.languageCode } },
      update: { translatedText: item.translatedText || '' },
      create: { keyId: key.id, languageCode: item.languageCode, translatedText: item.translatedText || '' }
    })
  }
}

export async function getForExport(projectId: string, languageCodes: string[]) {
  const keys = await prisma.translationKey.findMany({
    where: { projectId },
    include: { values: true },
    orderBy: { key: 'asc' },
  })
  return keys
}

export async function getAllTags(projectId: string) {
  const keys = await prisma.translationKey.findMany({ where: { projectId }, select: { tags: true } })
  const tags = new Set<string>()
  for (const k of keys) for (const t of k.tags) tags.add(t)
  return Array.from(tags)
}
