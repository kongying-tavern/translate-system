import type { Prisma } from '@prisma/client'
import { PROJECT_ROLE_LEVEL, ProjectRole } from '../constants/roles'
import { ErrCode } from '../lib/errors'
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
  /** 仅已锁定条目 */
  lockedOnly?: boolean
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

  // 多个筛选条件同时生效：标签 / 搜索 / 仅未翻译 / 仅已锁定 全部以 AND 组合
  let visible = allItems
  if (query.search || query.tags?.length || query.languageCode || query.untransOnly || query.lockedOnly) {
    if (query.lockedOnly)
      visible = visible.filter(item => item.key.isLocked)
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
    isLocked: item.key.isLocked,
    translations: Object.fromEntries(item.key.values.map(v => [v.languageCode, {
      id: v.id,
      translatedText: v.translatedText,
      isReviewed: v.isReviewed,
      reviewerComment: v.reviewerComment,
    }])),
  }))

  return { list, total }
}

/** 新增 Key（仅创建 key + 可选原文/标签/备注；原文与译文编辑分别走 updateKeyByKeyId / saveValueForLang） */
export async function createTranslation(projectId: string, data: {
  translationKey: string
  sourceText?: string
  context?: string
  tags?: string[]
}) {
  const sourceLang = await getSourceLanguage(projectId)
  let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: data.translationKey } } })
  if (!key) {
    const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
    key = await prisma.translationKey.create({
      data: { projectId, key: data.translationKey, context: data.context || '', tags: data.tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 },
    })
  }
  if (data.sourceText && sourceLang) {
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode: sourceLang } },
      update: { translatedText: data.sourceText },
      create: { keyId: key.id, languageCode: sourceLang, translatedText: data.sourceText },
    })
  }
  return key
}

/** 更新 key 级属性（keyId 定位）：Key 名 / 原文 / 标签 / 备注 / 锁定 */
export async function updateKeyByKeyId(projectId: string, keyId: string, data: {
  translationKey?: string
  sourceText?: string
  tags?: string[]
  context?: string
  isLocked?: boolean
}, projectRole?: string) {
  const existing = await prisma.translationKey.findUnique({ where: { id: keyId } })
  if (!existing || existing.projectId !== projectId)
    throw new AppError(ErrCode.NotFound, 'Key 不存在或不属于该项目')

  // 锁定条目：非 Maintainer+ 仅允许切换锁定状态，其余属性拒绝修改
  if (existing.isLocked && projectRole !== undefined && (PROJECT_ROLE_LEVEL[projectRole] ?? 0) < (PROJECT_ROLE_LEVEL[ProjectRole.Maintainer] ?? 0)) {
    const hasOtherFields = data.translationKey !== undefined || data.sourceText !== undefined || data.tags !== undefined || data.context !== undefined
    if (hasOtherFields)
      throw new AppError(ErrCode.InvalidParams, '该条目已锁定，请联系项目管理员解锁后再编辑')
  }

  // Key 原样保存（不 trim），仅校验非空白；前后端约定一致
  const newKey = data.translationKey
  if (newKey !== undefined && newKey !== existing.key) {
    if (!newKey.trim())
      throw new AppError(ErrCode.InvalidParams, 'Key 不能为空')
    const dup = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: newKey } } })
    if (dup)
      throw new AppError(ErrCode.Conflict, 'Key 已存在，不能重复')
  }

  const updateData: Prisma.TranslationKeyUpdateInput = {}
  if (newKey !== undefined)
    updateData.key = newKey
  if (data.tags !== undefined)
    updateData.tags = data.tags
  if (data.context !== undefined)
    updateData.context = data.context
  if (data.isLocked !== undefined)
    updateData.isLocked = data.isLocked
  if (Object.keys(updateData).length)
    await prisma.translationKey.update({ where: { id: keyId }, data: updateData })

  // 原文写入源语言语言值
  if (data.sourceText !== undefined) {
    const sourceLang = await getSourceLanguage(projectId)
    if (sourceLang) {
      await prisma.translationValue.upsert({
        where: { keyId_languageCode: { keyId, languageCode: sourceLang } },
        update: { translatedText: data.sourceText },
        create: { keyId, languageCode: sourceLang, translatedText: data.sourceText },
      })
    }
  }
  return { keyId, count: 1 }
}

/** 保存指定语言译文（keyId 定位）。目标语言必须是项目语言，且不能是源语言（原文走 key 级接口）。锁定条目仅 Maintainer+ 可编辑 */
export async function saveValueForLang(projectId: string, keyId: string, languageCode: string, translatedText: string, projectRole?: string) {
  const key = await prisma.translationKey.findUnique({ where: { id: keyId } })
  if (!key || key.projectId !== projectId)
    throw new AppError(ErrCode.NotFound, 'Key 不存在或不属于该项目')

  // 锁定条目仅 Maintainer+ 可编辑译文；super_admin/owner 经 assertProjectAccess 返回 projectRole='admin' 自动放行
  if (key.isLocked && projectRole !== undefined && (PROJECT_ROLE_LEVEL[projectRole] ?? 0) < (PROJECT_ROLE_LEVEL[ProjectRole.Maintainer] ?? 0))
    throw new AppError(ErrCode.InvalidParams, '该条目已锁定，无法编辑译文，请联系项目管理员解锁')

  const sourceLang = await getSourceLanguage(projectId)
  if (languageCode === sourceLang)
    throw new AppError(ErrCode.InvalidParams, '源语言为项目原文，原文内容请在「原文」列中编辑修改')

  const projectLang = await prisma.projectLanguage.findUnique({
    where: { projectId_languageCode: { projectId, languageCode } },
  })
  if (!projectLang)
    throw new AppError(ErrCode.InvalidParams, `语言 ${languageCode} 不是项目语言`)

  return prisma.translationValue.upsert({
    where: { keyId_languageCode: { keyId, languageCode } },
    update: { translatedText },
    create: { keyId, languageCode, translatedText },
  })
}

export async function deleteTranslation(id: string) {
  return prisma.translationKey.delete({ where: { id } })
}

export async function batchUpsert(projectId: string, items: BatchUpsertItem[]) {
  const sourceLang = await getSourceLanguage(projectId)
  for (const item of items) {
    let key = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key: item.translationKey } } })
    if (!key) {
      const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
      key = await prisma.translationKey.create({
        data: { projectId, key: item.translationKey, context: item.context || '', tags: item.tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 },
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
