import type { Prisma } from '@prisma/client'
import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import type { ImportEntry } from '../services/import/types'
import { Body, Controller, Middlewares, Path, Post, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { ImportFormat } from '../lib/formats'
import { prisma } from '../lib/prisma'
import { decodePathParams } from '../middleware/decodePathParams'
import { csvParse } from '../services/import/csv'
import { JSONParse } from '../services/import/json'
import { propertiesParse } from '../services/import/properties'
import { xmlParse } from '../services/import/xml'
import { yamlParse } from '../services/import/yaml'
import { AppError } from '../utils/AppError'

export interface ImportResult {
  /** 解析出的去重翻译键数量 */
  importedKeys: number
  /** 解析出的条目总数（含多语言格式展开） */
  importedFields: number
  /** 新建数量（条目维度） */
  created: number
  /** 新建的去重翻译键数量 */
  createdKeys: number
  /** 跳过数量（条目维度，含因项目未配置语言而跳过的） */
  skipped: number
  /** 跳过的去重翻译键数量 */
  skippedKeys: number
  /** 因项目未配置语言而被跳过的语言代码（去重） */
  skippedLanguages: string[]
}

export interface ImportEntriesBody {
  /**
   * 导入数据（JSON 对象或 json/yaml/xml/properties/csv 原始文本，格式自动识别）
   * @example {"login.title": {"sourceText": "登录", "context": "首页", "tags": ["auth"]}}
   */
  data: string | Record<string, unknown>
  /**
   * 覆盖已有 Key（true 时更新已存在 Key 的原文/上下文/标签）
   * @example true
   */
  overwrite?: boolean
}

export interface ImportTranslationsBody {
  /**
   * 目标语言代码（data 条目未带语言时使用）
   * @example "zh-Hans"
   */
  languageCode?: string
  /**
   * 数据格式类型（json/yaml/xml/properties/csv，与 data 内容一致）
   * @example "json"
   */
  formatType: string
  /**
   * 导入数据（JSON 对象或对应格式的原始文本）
   * @example {"login.title": {"translatedText": "登录", "context": "首页"}}
   */
  data: string | Record<string, unknown>
  /**
   * 覆盖已有译文（false 时已有译文不更新）
   * @example false
   */
  overwrite?: boolean
  /**
   * 自动创建缺失的 Key
   * @example true
   */
  autoCreate?: boolean
}

function sniffFormat(raw: string): ImportFormat {
  const t = raw.trim()
  if (t.startsWith('{') || t.startsWith('['))
    return ImportFormat.JSON
  if (t.startsWith('<'))
    return ImportFormat.XML
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  const some = (re: RegExp) => lines.some(l => re.test(l))
  if (some(/^\s+/) || some(/^---/) || some(/^- /))
    return ImportFormat.YAML
  if (some(/^[\w.\-[/]+:\s/))
    return ImportFormat.YAML
  if (some(/^[\w.\-]+\s*=\s*/) || some(/^[\w.\-]+:[^ /\t]/))
    return ImportFormat.Properties
  return ImportFormat.CSV
}

interface ParsedImport {
  entries: Iterable<ImportEntry>
  importedKeys: number
  importedFields: number
}

function parseImportData(raw: string, fmt: string): ParsedImport {
  let entries: Iterable<ImportEntry>
  try {
    switch (fmt) {
      case ImportFormat.JSON:
        entries = JSONParse(raw)
        break
      case ImportFormat.CSV:
        entries = csvParse(raw)
        break
      case ImportFormat.Properties:
        entries = propertiesParse(raw)
        break
      case ImportFormat.YAML:
        entries = yamlParse(raw)
        break
      case ImportFormat.XML:
        entries = xmlParse(raw)
        break
      default:
        entries = []
    }
  }
  catch (e) {
    if (e instanceof AppError)
      throw e
    throw new AppError(ErrCode.InvalidParams, '数据解析失败，请检查文件格式是否正确')
  }
  const keys = new Set<string>()
  let imported = 0
  for (const entry of entries) {
    imported++
    if (entry.key?.trim())
      keys.add(entry.key)
    if (!entry.key || !entry.key.trim())
      throw new AppError(ErrCode.InvalidParams, `第 ${imported} 条缺少翻译键（key/name），已拒绝导入`)
  }
  if (!imported)
    throw new AppError(ErrCode.InvalidParams, '未从数据中解析到任何条目，请检查文件格式与内容')
  return { entries, importedKeys: keys.size, importedFields: imported }
}

const IMPORT_BATCH = 1000

/** 每批出现的新 key 用游标递增分配 sortOrder，避免逐条 aggregate；整个导入仅首次需查 maxSo */
async function ensureSortCursor(projectId: string, cursor: { nextSo: number }): Promise<void> {
  const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  cursor.nextSo = (maxSo._max.sortOrder || 0) + 100
}

async function importKeys(projectId: string, raw: string, fmt: ImportFormat, overwrite: boolean): Promise<ImportResult> {
  const { entries, importedKeys, importedFields } = parseImportData(raw, fmt)
  const sourceLang = (await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } }))?.sourceLanguage || ''
  let created = 0
  let skipped = 0
  const createdKeySet = new Set<string>()
  const skippedKeySet = new Set<string>()
  const cursor = { nextSo: 0 }
  let inited = false

  const flush = async (batch: ImportEntry[]): Promise<void> => {
    // 1. 预加载本批已有 key，建 key→id 映射，消掉逐条 findUnique
    const keys = [...new Set(batch.map(e => e.key))]
    const existingKeys = await prisma.translationKey.findMany({
      where: { projectId, key: { in: keys } },
      select: { id: true, key: true },
    })
    const keyMap = new Map<string, string>(existingKeys.map(r => [r.key, r.id]))
    const existedSet = new Set(existingKeys.map(r => r.key))

    // 2. 排序游标：首次惰性初始化，后续沿用上次末值递增
    const newKeysInOrder: string[] = []
    const seenNew = new Set<string>()
    for (const e of batch) {
      if (!keyMap.has(e.key) && !seenNew.has(e.key)) {
        seenNew.add(e.key)
        newKeysInOrder.push(e.key)
      }
    }
    if (newKeysInOrder.length && !inited) {
      await ensureSortCursor(projectId, cursor)
      inited = true
    }

    // 3. 新 key 一次 createMany 批量创建（按文件顺序分配 sortOrder），再按 key 拉回 id
    if (newKeysInOrder.length) {
      const firstOf = new Map<string, ImportEntry>()
      for (const e of batch) {
        if (!firstOf.has(e.key))
          firstOf.set(e.key, e)
      }
      await prisma.translationKey.createMany({
        data: newKeysInOrder.map((k, i) => {
          const e = firstOf.get(k)!
          return {
            projectId,
            key: k,
            context: e.context || '',
            tags: e.tags || [],
            sortOrder: cursor.nextSo + i * 100,
          }
        }),
      })
      cursor.nextSo += newKeysInOrder.length * 100
      const createdRows = await prisma.translationKey.findMany({ where: { projectId, key: { in: newKeysInOrder } }, select: { id: true, key: true } })
      for (const r of createdRows)
        keyMap.set(r.key, r.id)
    }

    // 4. 预加载本批已存在的源语言值，区分「新建 createMany」/「需更新 update」
    let existingVals = new Map<string, string>()
    if (sourceLang && keyMap.size) {
      const vals = await prisma.translationValue.findMany({
        where: { keyId: { in: [...keyMap.values()] }, languageCode: sourceLang },
        select: { keyId: true, translatedText: true },
      })
      existingVals = new Map(vals.map(v => [v.keyId, v.translatedText]))
    }

    const toCreateVals: Prisma.TranslationValueCreateManyInput[] = []
    const toUpdateVals: Prisma.TranslationValueUpdateArgs[] = []

    for (const entry of batch) {
      const { key, context, tags } = entry
      const keyId = keyMap.get(key)
      const keyExisted = existedSet.has(key)
      if (keyExisted && !overwrite) {
        skipped++
        skippedKeySet.add(key)
        continue
      }
      if (keyExisted && (context !== undefined || tags?.length)) {
        const updates: Prisma.TranslationKeyUpdateInput = {}
        if (context !== undefined)
          updates.context = context
        if (tags?.length)
          updates.tags = tags
        if (Object.keys(updates).length)
          await prisma.translationKey.update({ where: { id: keyId! }, data: updates })
      }
      // 原文 = sourceText 或源语言列，等价于源语言的翻译更新
      if (sourceLang && keyId) {
        let sourceVal: string | undefined
        if (entry.sourceText && entry.sourceText !== key)
          sourceVal = entry.sourceText
        if (sourceVal === undefined && entry.lang === sourceLang && entry.translatedText)
          sourceVal = entry.translatedText
        if (sourceVal !== undefined) {
          const existingText = existingVals.get(keyId)
          if (existingText === undefined) {
            toCreateVals.push({ keyId, languageCode: sourceLang, translatedText: sourceVal })
          }
          else if (existingText !== sourceVal) {
            toUpdateVals.push({
              where: { keyId_languageCode: { keyId, languageCode: sourceLang } },
              data: { translatedText: sourceVal },
            })
          }
        }
      }
      created++
      createdKeySet.add(key)
    }

    if (toCreateVals.length)
      await prisma.translationValue.createMany({ data: toCreateVals })
    if (toUpdateVals.length)
      await prisma.$transaction(toUpdateVals.map(u => prisma.translationValue.update(u)))
  }

  let batch: ImportEntry[] = []
  for (const entry of entries) {
    batch.push(entry)
    if (batch.length >= IMPORT_BATCH) {
      await flush(batch)
      batch = []
    }
  }
  if (batch.length)
    await flush(batch)
  return { importedKeys, importedFields, created, createdKeys: createdKeySet.size, skipped, skippedKeys: skippedKeySet.size, skippedLanguages: [] }
}

async function applyTranslations(projectId: string, raw: string, fmt: string, languageCode: string, overwrite: boolean, autoCreate: boolean): Promise<ImportResult> {
  const { entries, importedKeys, importedFields } = parseImportData(raw, fmt)
  const projectLangs = await prisma.projectLanguage.findMany({ where: { projectId }, select: { languageCode: true, alias: true } })
  const knownLangs = new Set<string>()
  for (const l of projectLangs) {
    knownLangs.add(l.languageCode)
    if (l.alias)
      knownLangs.add(l.alias)
  }
  const unknownLangs = new Set<string>()
  let created = 0
  let skipped = 0
  const createdKeySet = new Set<string>()
  const skippedKeySet = new Set<string>()
  const cursor = { nextSo: 0 }
  let inited = false

  const flush = async (batch: ImportEntry[]): Promise<void> => {
    // 1. 预加载本批已有 key，建 key→id 映射，消掉逐条 findUnique
    const keys = [...new Set(batch.map(e => e.key))]
    const existingKeys = await prisma.translationKey.findMany({
      where: { projectId, key: { in: keys } },
      select: { id: true, key: true },
    })
    const keyMap = new Map<string, string>(existingKeys.map(r => [r.key, r.id]))
    const existedSet = new Set(existingKeys.map(r => r.key))

    // 2. 排序游标：首次惰性初始化，后续沿用上次末值递增
    const newKeysInOrder: string[] = []
    const seenNew = new Set<string>()
    for (const e of batch) {
      if (!keyMap.has(e.key) && !seenNew.has(e.key)) {
        seenNew.add(e.key)
        newKeysInOrder.push(e.key)
      }
    }
    if (newKeysInOrder.length && !inited) {
      await ensureSortCursor(projectId, cursor)
      inited = true
    }

    // 3. 新 key 一次 createMany 批量创建（按文件顺序分配 sortOrder），再按 key 拉回 id
    const toAutoCreate = autoCreate !== false ? newKeysInOrder : []
    if (toAutoCreate.length) {
      const firstOf = new Map<string, ImportEntry>()
      for (const e of batch) {
        if (!firstOf.has(e.key))
          firstOf.set(e.key, e)
      }
      await prisma.translationKey.createMany({
        data: toAutoCreate.map((k, i) => {
          const e = firstOf.get(k)!
          return {
            projectId,
            key: k,
            context: e.context || '',
            tags: e.tags || [],
            sortOrder: cursor.nextSo + i * 100,
          }
        }),
      })
      cursor.nextSo += toAutoCreate.length * 100
      const createdRows = await prisma.translationKey.findMany({ where: { projectId, key: { in: toAutoCreate } }, select: { id: true, key: true } })
      for (const r of createdRows)
        keyMap.set(r.key, r.id)
    }

    // 预加载本批涉及的译文值（keyId×language），区分「新建 createMany」/「需更新 update」/「已存在跳过」
    const valueKeyIdSet = new Set<string>()
    const valueLangSet = new Set<string>()
    for (const entry of batch) {
      const langCode = entry.lang || languageCode
      const keyId = keyMap.get(entry.key)
      if (!langCode || !knownLangs.has(langCode) || !keyId || entry.translatedText === undefined)
        continue
      valueKeyIdSet.add(keyId)
      valueLangSet.add(langCode)
    }
    let existingValues = new Map<string, string>()
    if (valueKeyIdSet.size) {
      const vals = await prisma.translationValue.findMany({
        where: { keyId: { in: [...valueKeyIdSet] }, languageCode: { in: [...valueLangSet] } },
        select: { keyId: true, languageCode: true, translatedText: true },
      })
      existingValues = new Map(vals.map(v => [`${v.keyId}\u0000${v.languageCode}`, v.translatedText]))
    }

    const toCreateVals: Prisma.TranslationValueCreateManyInput[] = []
    const toUpdateVals: Prisma.TranslationValueUpdateArgs[] = []

    for (const entry of batch) {
      const { key, translatedText, context, tags, lang } = entry
      const langCode = lang || languageCode
      if (langCode && !knownLangs.has(langCode)) {
        unknownLangs.add(langCode)
        skipped++
        skippedKeySet.add(key)
        continue
      }
      const keyId = keyMap.get(key)
      if (keyId && existedSet.has(key) && (context !== undefined || tags?.length)) {
        const updates: Prisma.TranslationKeyUpdateInput = {}
        if (context !== undefined)
          updates.context = context
        if (tags?.length)
          updates.tags = tags
        if (Object.keys(updates).length)
          await prisma.translationKey.update({ where: { id: keyId }, data: updates })
      }
      if (keyId && translatedText !== undefined && langCode) {
        const vkey = `${keyId}\u0000${langCode}`
        const existingText = existingValues.get(vkey)
        const shouldWrite = overwrite
          ? true
          : (existingText === undefined || !existingText)
        if (shouldWrite) {
          if (existingText === undefined) {
            toCreateVals.push({ keyId, languageCode: langCode, translatedText })
          }
          else if (existingText !== translatedText) {
            toUpdateVals.push({
              where: { keyId_languageCode: { keyId, languageCode: langCode } },
              data: { translatedText },
            })
          }
          created++
          createdKeySet.add(key)
        }
        else {
          skipped++
          skippedKeySet.add(key)
        }
      }
    }

    if (toCreateVals.length)
      await prisma.translationValue.createMany({ data: toCreateVals })
    if (toUpdateVals.length)
      await prisma.$transaction(toUpdateVals.map(u => prisma.translationValue.update(u)))
  }

  let batch: ImportEntry[] = []
  for (const entry of entries) {
    batch.push(entry)
    if (batch.length >= IMPORT_BATCH) {
      await flush(batch)
      batch = []
    }
  }
  if (batch.length)
    await flush(batch)
  return { importedKeys, importedFields, created, createdKeys: createdKeySet.size, skipped, skippedKeys: skippedKeySet.size, skippedLanguages: [...unknownLangs] }
}

@Route('projects')
@Tags('Imports')
@Middlewares(decodePathParams)
export class ImportsController extends Controller {
  /**
   * 批量导入 key（json/yaml/xml/properties/csv，自动识别格式）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 批量导入 Key
   */
  @Post('{projectSlug}/imports/entries')
  @Security('auth')
  public async importEntries(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ImportEntriesBody): Promise<ApiOk<ImportResult>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    const raw = typeof body.data === 'string' ? body.data : JSON.stringify(body.data)
    return ok(await importKeys(access.projectId, raw, sniffFormat(raw), body.overwrite ?? false))
  }

  /**
   * 批量导入译文（需指定格式类型）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 批量导入译文
   */
  @Post('{projectSlug}/imports/translations')
  @Security('auth')
  public async importTranslations(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ImportTranslationsBody): Promise<ApiOk<ImportResult>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.formatType)
      throw new AppError(ErrCode.InvalidParams, 'formatType is required')
    const raw = typeof body.data === 'string' ? body.data : JSON.stringify(body.data)
    return ok(await applyTranslations(access.projectId, raw, body.formatType, body.languageCode ?? '', body.overwrite ?? false, body.autoCreate ?? true))
  }
}
