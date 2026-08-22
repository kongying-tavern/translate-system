import type { Response } from 'express'
import type { ApiOk } from '../lib/api'
import type { ImportControl, ImportProgress, ImportResult } from '../lib/import-lock'
import type { AuthRequest } from '../middleware/auth'
import type { ImportEntry } from '../services/import/types'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { Body, Controller, Get, Middlewares, Path, Post, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole, SystemRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { ImportFormat } from '../lib/formats'
import { abortImport, emitImportStatus, getImportLock, subscribeImportStatus, tryAcquireImportLock } from '../lib/import-lock'
import { prisma } from '../lib/prisma'
import { decodePathParams } from '../middleware/decodePathParams'
import { csvParse } from '../services/import/csv'
import { JSONParse } from '../services/import/json'
import { propertiesParse } from '../services/import/properties'
import { xmlParse } from '../services/import/xml'
import { yamlParse } from '../services/import/yaml'
import { AppError } from '../utils/AppError'

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

const IMPORT_BATCH = 1000
/** 跨批 key→id 缓存上限（优化 H）：超限整体清空，由后续批次重新查库（unique(project_id, key) 命中索引），防百万级 key 时 Map 无界膨胀 */
const IMPORT_KEY_CACHE_MAX = 50_000

/** 让出事件循环，避免长循环阻塞其他请求 */
function deferEventLoop(): Promise<void> {
  return new Promise<void>(r => setImmediate(r))
}

interface ValueUpsertRow {
  keyId: string
  languageCode: string
  translatedText: string
}

/**
 * 译文/原文值批量 upsert：单条原生 INSERT ... ON CONFLICT DO UPDATE 完成整批写入，
 * 替代逐条 translationValue.update 事务；同 key+lang 自动去重取末值（即优化 E）。
 * 仅构建查询、不执行，空数组返回 null，便于调用方决定是否需要纳入 $transaction（即优化 C）；
 * 需要独立执行时直接 `await bulkWriteTranslationValues(rows)` 即可。
 */
function bulkWriteTranslationValues(rows: ValueUpsertRow[]): Prisma.PrismaPromise<number> | null {
  const map = new Map<string, ValueUpsertRow>()
  for (const r of rows)
    map.set(`${r.keyId}\u0000${r.languageCode}`, r)
  const deduped = [...map.values()]
  if (!deduped.length)
    return null
  // id / updated_at 为 Prisma 客户端侧默认值，原生 INSERT 需自行提供
  const now = new Date()
  return prisma.$executeRaw`
    INSERT INTO "translation_values" ("id", "key_id", "language_code", "translated_text", "updated_at")
    VALUES ${Prisma.join(deduped.map(r => Prisma.sql`(${randomUUID()}::uuid, ${r.keyId}::uuid, ${r.languageCode}, ${r.translatedText}, ${now})`), ', ')}
    ON CONFLICT ("key_id", "language_code") DO UPDATE SET "translated_text" = EXCLUDED."translated_text", "updated_at" = EXCLUDED."updated_at"
  `
}

interface KeyMetaUpdate {
  id: string
  context?: string
  tags?: string[]
}

/**
 * Key 的 context/tags 批量更新（优化 B）：单条原生 `UPDATE ... FROM (VALUES ...)` 一次完成，替代 N 条 update 事务。
 * 各列按 has_* 标志仅在确有值时覆盖，未提供字段保留原值。tags 为 string[]，经参数化 + `::text[]` 交由驱动转义，无注入风险。
 */
function bulkUpdateKeyMeta(items: KeyMetaUpdate[]): Prisma.PrismaPromise<number> | null {
  if (!items.length)
    return null
  const valuesSql = Prisma.join(items.map(it => Prisma.sql`
    (${it.id}::uuid, ${it.context ?? null}, ${(it.tags ?? null)}::text[], ${(it.context !== undefined)}, ${(it.tags?.length ?? 0) > 0})
  `), ', ')
  return prisma.$executeRaw`
    UPDATE "translation_keys" AS tk SET
      "context" = CASE WHEN v.has_context THEN v.context ELSE tk."context" END,
      "tags" = CASE WHEN v.has_tags THEN v.tags ELSE tk."tags" END
    FROM (VALUES ${valuesSql}) AS v(id, context, tags, has_context, has_tags)
    WHERE tk."id" = v.id
  `
}

async function parseImportData(raw: string, fmt: string, ctrl: ImportControl): Promise<ParsedImport> {
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
    if (ctrl.aborted)
      throw new AppError(ErrCode.Conflict, '导入已中止')
    imported++
    if (entry.key?.trim()) {
      const prev = keys.size
      keys.add(entry.key)
      if (keys.size !== prev)
        ctrl.progress.parsedKeys = keys.size
    }
    if (!entry.key || !entry.key.trim())
      throw new AppError(ErrCode.InvalidParams, `第 ${imported} 条缺少翻译键（key/name），已拒绝导入`)
    if (imported % IMPORT_BATCH === 0) {
      ctrl.progress.parsedFields = imported
      await deferEventLoop()
      emitImportStatus(ctrl.projectId)
      if (ctrl.aborted)
        throw new AppError(ErrCode.Conflict, '导入已中止')
    }
  }
  if (!imported)
    throw new AppError(ErrCode.InvalidParams, '未从数据中解析到任何条目，请检查文件格式与内容')
  ctrl.progress.parsedFields = imported
  ctrl.progress.totalFields = imported
  ctrl.progress.totalKeys = keys.size
  ctrl.progress.phase = 'writing'
  return { entries, importedKeys: keys.size, importedFields: imported }
}

/** 每批出现的新 key 用游标递增分配 sortOrder，避免逐条 aggregate；整个导入仅首次需查 maxSo */
async function ensureSortCursor(projectId: string, cursor: { nextSo: number }): Promise<void> {
  const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  cursor.nextSo = (maxSo._max.sortOrder || 0) + 100
}

async function importKeys(projectId: string, raw: string, fmt: ImportFormat, overwrite: boolean, ctrl: ImportControl): Promise<ImportResult> {
  const { entries, importedKeys, importedFields } = await parseImportData(raw, fmt, ctrl)
  const sourceLang = (await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } }))?.sourceLanguage || ''
  let createdFields = 0
  let skippedFields = 0
  const createdKeySet = new Set<string>()
  const skippedKeySet = new Set<string>()
  const cursor = { nextSo: 0 }
  let inited = false
  /** 跨批缓存 key→id，避免每批重复查库 */
  const keyIdCache = new Map<string, string>()

  const flush = async (batch: ImportEntry[]): Promise<void> => {
    if (ctrl.aborted)
      throw new AppError(ErrCode.Conflict, '导入已中止')
    emitImportStatus(ctrl.projectId)
    // keyIdCache 封顶（优化 H）：超限整体清空，本批起重新查库
    if (keyIdCache.size > IMPORT_KEY_CACHE_MAX)
      keyIdCache.clear()
    // 1. 预加载本批缺失 key→id（已缓存跳过），建映射；existedSet 仅含本批查到的已存在 key
    const batchKeys = [...new Set(batch.map(e => e.key))]
    const uncached = batchKeys.filter(k => !keyIdCache.has(k))
    if (uncached.length) {
      const existingKeys = await prisma.translationKey.findMany({
        where: { projectId, key: { in: uncached } },
        select: { id: true, key: true },
      })
      for (const r of existingKeys)
        keyIdCache.set(r.key, r.id)
    }
    const keyMap = new Map<string, string>()
    const existedSet = new Set<string>()
    for (const k of batchKeys) {
      const id = keyIdCache.get(k)
      if (id) {
        keyMap.set(k, id)
        existedSet.add(k)
      }
    }

    // 2. 排序游标：首次惰性初始化，后续沿用上次末值递增
    const newKeysInOrder: string[] = []
    const seenNew = new Set<string>()
    for (const e of batch) {
      if (!keyIdCache.has(e.key) && !seenNew.has(e.key)) {
        seenNew.add(e.key)
        newKeysInOrder.push(e.key)
      }
    }
    if (newKeysInOrder.length && !inited) {
      await ensureSortCursor(projectId, cursor)
      inited = true
    }

    // 3. 新 key 一次 createMany 批量创建（按文件顺序分配 sortOrder），再按 key 拉回 id 并写入缓存
    if (newKeysInOrder.length) {
      const firstOf = new Map<string, ImportEntry>()
      for (const e of batch) {
        if (!firstOf.has(e.key))
          firstOf.set(e.key, e)
      }
      const createdRows = await prisma.translationKey.createManyAndReturn({
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
      for (const r of createdRows) {
        keyMap.set(r.key, r.id)
        keyIdCache.set(r.key, r.id)
      }
    }

    // 4. 预加载本批已存在的源语言值，区分「需新建」/「需更新」
    let existingVals = new Map<string, string>()
    if (sourceLang && keyMap.size) {
      const vals = await prisma.translationValue.findMany({
        where: { keyId: { in: [...keyMap.values()] }, languageCode: sourceLang },
        select: { keyId: true, translatedText: true },
      })
      existingVals = new Map(vals.map(v => [v.keyId, v.translatedText]))
    }

    const toWrite: ValueUpsertRow[] = []
    const keyUpdateMap = new Map<string, Prisma.TranslationKeyUpdateInput>()

    for (const entry of batch) {
      const { key, context, tags } = entry
      const keyId = keyMap.get(key)
      const keyExisted = existedSet.has(key)
      if (keyExisted && !overwrite) {
        skippedFields++
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
          keyUpdateMap.set(keyId!, updates)
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
          if (existingText === undefined || existingText !== sourceVal)
            toWrite.push({ keyId, languageCode: sourceLang, translatedText: sourceVal })
        }
      }
      createdFields++
      createdKeySet.add(key)
    }

    // 优化 C：Key 属性更新（bulkUpdateKeyMeta 原生单条 UPDATE）与译文值 upsert（bulkWriteTranslationValues）合并为同一个 $transaction 提交
    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (keyUpdateMap.size) {
      const metaItems: KeyMetaUpdate[] = [...keyUpdateMap.entries()].map(([id, data]) => ({
        id,
        context: typeof data.context === 'string' ? data.context : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
      }))
      const metaQ = bulkUpdateKeyMeta(metaItems)
      if (metaQ)
        ops.push(metaQ)
    }
    const valQ = bulkWriteTranslationValues(toWrite)
    if (valQ)
      ops.push(valQ)
    if (ops.length)
      await prisma.$transaction(ops)
    ctrl.progress.createdFields = createdFields
    ctrl.progress.skippedFields = skippedFields
    ctrl.progress.createdKeys = createdKeySet.size
    ctrl.progress.skippedKeys = skippedKeySet.size
  }

  let batch: ImportEntry[] = []
  for (const entry of entries) {
    if (ctrl.aborted)
      throw new AppError(ErrCode.Conflict, '导入已中止')
    batch.push(entry)
    if (batch.length >= IMPORT_BATCH) {
      await flush(batch)
      batch = []
    }
  }
  if (batch.length && !ctrl.aborted)
    await flush(batch)
  if (ctrl.aborted)
    throw new AppError(ErrCode.Conflict, '导入已中止')
  ctrl.progress.phase = 'done'
  return { importedKeys, importedFields, createdFields, createdKeys: createdKeySet.size, skippedFields, skippedKeys: skippedKeySet.size, skippedLanguages: [] }
}

async function applyTranslations(projectId: string, raw: string, fmt: string, languageCode: string, overwrite: boolean, autoCreate: boolean, ctrl: ImportControl): Promise<ImportResult> {
  const { entries, importedKeys, importedFields } = await parseImportData(raw, fmt, ctrl)
  const [projectLangs, project] = await Promise.all([
    prisma.projectLanguage.findMany({ where: { projectId }, select: { languageCode: true, alias: true } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } }),
  ])
  const sourceLang = project?.sourceLanguage ?? ''
  /** 语言代码/别名 → 项目语言规范 code 的映射：比对与写入均用规范 code（alias 导入归一写真实语言，不落游离于项目语言之外的 value 行） */
  const langCanonical = new Map<string, string>()
  for (const l of projectLangs) {
    langCanonical.set(l.languageCode, l.languageCode)
    if (l.alias)
      langCanonical.set(l.alias, l.languageCode)
  }
  const unknownLangs = new Set<string>()
  let createdFields = 0
  let skippedFields = 0
  let sourceSkippedFields = 0
  const createdKeySet = new Set<string>()
  const skippedKeySet = new Set<string>()
  const cursor = { nextSo: 0 }
  let inited = false
  /** 跨批缓存 key→id，避免每批重复查库 */
  const keyIdCache = new Map<string, string>()

  const flush = async (batch: ImportEntry[]): Promise<void> => {
    if (ctrl.aborted)
      throw new AppError(ErrCode.Conflict, '导入已中止')
    emitImportStatus(ctrl.projectId)
    // keyIdCache 封顶（优化 H）：超限整体清空，本批起重新查库
    if (keyIdCache.size > IMPORT_KEY_CACHE_MAX)
      keyIdCache.clear()
    // 1. 预加载本批缺失 key→id（已缓存跳过），建映射；existedSet 仅含本批查到的已存在 key
    const batchKeys = [...new Set(batch.map(e => e.key))]
    const uncached = batchKeys.filter(k => !keyIdCache.has(k))
    if (uncached.length) {
      const existingKeys = await prisma.translationKey.findMany({
        where: { projectId, key: { in: uncached } },
        select: { id: true, key: true },
      })
      for (const r of existingKeys)
        keyIdCache.set(r.key, r.id)
    }
    const keyMap = new Map<string, string>()
    const existedSet = new Set<string>()
    for (const k of batchKeys) {
      const id = keyIdCache.get(k)
      if (id) {
        keyMap.set(k, id)
        existedSet.add(k)
      }
    }

    // 2. 排序游标：首次惰性初始化，后续沿用上次末值递增
    const newKeysInOrder: string[] = []
    const seenNew = new Set<string>()
    for (const e of batch) {
      if (!keyIdCache.has(e.key) && !seenNew.has(e.key)) {
        seenNew.add(e.key)
        newKeysInOrder.push(e.key)
      }
    }
    if (newKeysInOrder.length && !inited) {
      await ensureSortCursor(projectId, cursor)
      inited = true
    }

    // 3. 新 key 一次 createMany 批量创建（按文件顺序分配 sortOrder），再按 key 拉回 id 并写入缓存
    const toAutoCreate = autoCreate !== false ? newKeysInOrder : []
    if (toAutoCreate.length) {
      const firstOf = new Map<string, ImportEntry>()
      for (const e of batch) {
        if (!firstOf.has(e.key))
          firstOf.set(e.key, e)
      }
      const createdRows = await prisma.translationKey.createManyAndReturn({
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
      for (const r of createdRows) {
        keyMap.set(r.key, r.id)
        keyIdCache.set(r.key, r.id)
      }
    }

    // 预加载本批涉及的译文值（keyId×language），区分「新建 createMany」/「需更新 update」/「已存在跳过」
    const valueKeyIdSet = new Set<string>()
    const valueLangSet = new Set<string>()
    for (const entry of batch) {
      const langCode = langCanonical.get(entry.lang || languageCode)
      const keyId = keyMap.get(entry.key)
      if (!langCode || !keyId || entry.translatedText === undefined)
        continue
      valueKeyIdSet.add(keyId)
      valueLangSet.add(langCode)
    }
    let existingValues = new Map<string, string>()
    if (valueKeyIdSet.size && valueLangSet.size) {
      // 优化 F：用 (key_id, language_code) 元组 IN 精确匹配，避免 keyId IN ∧ lang IN 的笛卡尔积回查
      const pairSql = Prisma.join([...valueKeyIdSet].flatMap(kid => [...valueLangSet].map(lc => Prisma.sql`(${kid}::uuid, ${lc})`)), ', ')
      const vals = await prisma.$queryRaw<Array<{ key_id: string, language_code: string, translated_text: string }>>`
        SELECT "key_id", "language_code", "translated_text"
        FROM "translation_values"
        WHERE ("key_id", "language_code") IN (${pairSql})
      `
      existingValues = new Map(vals.map(v => [`${v.key_id}\u0000${v.language_code}`, v.translated_text]))
    }

    const toWrite: ValueUpsertRow[] = []
    const keyUpdateMap = new Map<string, Prisma.TranslationKeyUpdateInput>()

    for (const entry of batch) {
      const { key, translatedText, context, tags, lang } = entry
      const langCode = langCanonical.get(lang || languageCode) ?? ''
      const keyId = keyMap.get(key)
      if (keyId && existedSet.has(key) && (context !== undefined || tags?.length)) {
        const updates: Prisma.TranslationKeyUpdateInput = {}
        if (context !== undefined)
          updates.context = context
        if (tags?.length)
          updates.tags = tags
        if (Object.keys(updates).length)
          keyUpdateMap.set(keyId, updates)
      }
      // 无法写入的条目（无匹配 key、译文为空、或语言未配置）一律计入「跳过」，保证 created+skipped = imported 恒等式成立
      if (!keyId || translatedText === undefined || !langCode) {
        skippedFields++
        skippedKeySet.add(key)
        continue
      }
      const vkey = `${keyId}\u0000${langCode}`
      const existingText = existingValues.get(vkey)
      const shouldWrite = overwrite
        ? true
        : (existingText === undefined || !existingText)
      if (shouldWrite) {
        if (existingText === undefined || existingText !== translatedText)
          toWrite.push({ keyId, languageCode: langCode, translatedText })
        createdFields++
        createdKeySet.add(key)
      }
      else {
        skippedFields++
        skippedKeySet.add(key)
      }
    }

    // 优化 C：Key 属性更新（bulkUpdateKeyMeta 原生单条 UPDATE）与译文值 upsert（bulkWriteTranslationValues）合并为同一个 $transaction 提交
    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (keyUpdateMap.size) {
      const metaItems: KeyMetaUpdate[] = [...keyUpdateMap.entries()].map(([id, data]) => ({
        id,
        context: typeof data.context === 'string' ? data.context : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
      }))
      const metaQ = bulkUpdateKeyMeta(metaItems)
      if (metaQ)
        ops.push(metaQ)
    }
    const valQ = bulkWriteTranslationValues(toWrite)
    if (valQ)
      ops.push(valQ)
    if (ops.length)
      await prisma.$transaction(ops)
    ctrl.progress.createdFields = createdFields
    ctrl.progress.skippedFields = skippedFields
    ctrl.progress.createdKeys = createdKeySet.size
    ctrl.progress.skippedKeys = skippedKeySet.size
  }

  // 语言预过滤与分批写入同属单次流式遍历（优化 G）：不支持的语言整条丢弃（不建空 key）并在此计入 skipped 统计，
  // 无 filteredEntries 全量中间数组——多语言大 CSV 展开的百万级条目若物化全量数组会直接 OOM。
  // imported 由 parseImportData 按全量 entries 计算，skipped 在此累加，口径与「逐条 skip」完全一致
  let batch: ImportEntry[] = []
  for (const entry of entries) {
    const rawLang = entry.lang || languageCode
    const canonical = langCanonical.get(rawLang)
    if (!canonical) {
      // 未配置的语言（或无语言）：整条丢弃计入 skipped；unknownLangs 仅供结果提示
      if (rawLang)
        unknownLangs.add(rawLang)
      skippedFields++
      skippedKeySet.add(entry.key)
      continue
    }
    if (canonical === sourceLang) {
      // 源语言的译文即原文列：翻译导入恒不触碰（无论是否勾选覆盖），计入 skipped 并单独统计提示
      sourceSkippedFields++
      skippedFields++
      skippedKeySet.add(entry.key)
      continue
    }
    if (ctrl.aborted)
      throw new AppError(ErrCode.Conflict, '导入已中止')
    batch.push(entry)
    if (batch.length >= IMPORT_BATCH) {
      await flush(batch)
      batch = []
    }
  }
  if (batch.length && !ctrl.aborted)
    await flush(batch)
  if (ctrl.aborted)
    throw new AppError(ErrCode.Conflict, '导入已中止')
  ctrl.progress.phase = 'done'
  // skippedKeys 仅计「从未成功写入」的去重 key，排除已在 createdKeySet 中的 key（如混合语言 key 部分语言被预过滤跳过、部分语言正常写入），保证 createdKeys + skippedKeys = importedKeys
  let realSkippedKeys = 0
  for (const k of skippedKeySet) {
    if (!createdKeySet.has(k))
      realSkippedKeys++
  }
  return { importedKeys, importedFields, createdFields, createdKeys: createdKeySet.size, skippedFields, skippedKeys: realSkippedKeys, skippedLanguages: [...unknownLangs], sourceSkippedFields }
}

/**
 * 后台执行导入：不阻塞 HTTP 响应，完成后把结果写入 ctrl 并标记 done。
 * 失败/被中止时记录 error；控制对象保留（下次导入会覆盖），期间进度仍可通过 status 读取。
 */
function runImportInBackground(ctrl: ImportControl, task: () => Promise<ImportResult>): void {
  emitImportStatus(ctrl.projectId)
  void task()
    .then(async (result) => {
      ctrl.progress.phase = 'done'
      ctrl.result = result
      ctrl.done = true
      emitImportStatus(ctrl.projectId)
      // 导入完成（大量写入后）刷新规划器统计，确保后续列表/导出查询稳定走索引；失败不影响导入结果
      try {
        await prisma.$executeRaw`ANALYZE "translation_keys"`
        await prisma.$executeRaw`ANALYZE "translation_values"`
      }
      catch {
        // 统计刷新失败不影响导入结果
      }
    })
    .catch((e: unknown) => {
      ctrl.progress.phase = 'done'
      ctrl.error = e instanceof Error ? e.message : String(e)
      ctrl.done = true
      emitImportStatus(ctrl.projectId)
    })
}

/** userId → username 缓存，避免 SSE 每次推送都查库 */
const usernameCache = new Map<string, string>()
async function getUsername(userId: string): Promise<string> {
  const cached = usernameCache.get(userId)
  if (cached !== undefined)
    return cached
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
  const name = u?.username || ''
  usernameCache.set(userId, name)
  return name
}

/** 由内存控制对象构建对外状态 Row（供 status 快照与 SSE 推送共用） */
async function buildImportStatusRow(projectId: string): Promise<ImportStatusRow> {
  const lock = getImportLock(projectId)
  if (!lock)
    return { locked: false, type: '', startUserId: '', startUsername: '', startTimestamp: 0, progress: null, result: null, error: null }
  return {
    locked: !lock.done,
    type: lock.type,
    startUserId: lock.userId,
    startUsername: await getUsername(lock.userId),
    startTimestamp: lock.startedAt,
    progress: { ...lock.progress },
    result: lock.done ? (lock.result ?? null) : null,
    error: lock.done ? (lock.error ?? null) : null,
  }
}

@Route('projects')
@Tags('Imports')
@Middlewares(decodePathParams)
export class ImportsController extends Controller {
  /**
   * 查询项目导入状态（是否正有导入在跑及其发起信息）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 查询导入状态
   */
  @Get('{projectSlug}/imports/status')
  @Security('auth')
  public async getImportStatus(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<ImportStatusRow>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    return ok(await buildImportStatusRow(access.projectId))
  }

  /**
   * 导入状态 SSE 流：长连接持续推送该项目导入状态变更（进度/完成/中止），替代前端轮询。
   * 鉴权同 status 接口（任意项目成员可订阅）；连接建立即推送当前快照，状态变更时增量推送。
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 订阅导入状态流
   */
  @Get('{projectSlug}/imports/status/stream')
  @Security('auth')
  public async getImportStatusStream(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<void> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug)
    // @Res() 注入的是 TSOA 响应回调函数（无 status/setHeader 方法），SSE 需从 req.res 取真实 Express Response
    const response = req.res as Response
    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    // 立即冲刷响应头：headersSent 置真后，方法返回时 TSOA 的 returnHandler 不会再 end() 掉长连接
    response.flushHeaders()
    const send = async () => {
      try {
        const row = await buildImportStatusRow(access.projectId)
        response.write(`data: ${JSON.stringify(row)}\n\n`)
      }
      catch {
        // 单条推送失败不影响连接
      }
    }
    await send()
    // 节流：导入进行中每 250ms 最多推一次，避免大批量逐批推送刷爆前端；解锁/结束态恒推
    const lastEmit = { t: 0 }
    const unsub = subscribeImportStatus(access.projectId, () => {
      const now = Date.now()
      // 优化 D：先读内存锁状态判节流，被节流时不再 buildImportStatusRow（省去建行 + JSON 序列化的开销）
      const lock = getImportLock(access.projectId)
      if (lastEmit.t && now - lastEmit.t < 250 && lock && !lock.done)
        return
      lastEmit.t = now
      void (async () => {
        try {
          const row = await buildImportStatusRow(access.projectId)
          response.write(`data: ${JSON.stringify(row)}\n\n`)
        }
        catch {
          // 单条推送失败不影响连接
        }
      })()
    })
    const ping = setInterval(() => response.write(': ping\n\n'), 25000)
    req.on('close', () => {
      clearInterval(ping)
      unsub()
    })
  }

  /**
   * 批量导入 key（json/yaml/xml/properties/csv，自动识别格式）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @param body 请求体
   * @summary 批量导入 Key
   */
  @Post('{projectSlug}/imports/entries')
  @Security('auth')
  public async importEntries(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ImportEntriesBody): Promise<ApiOk<{ accepted: true }>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    const ctrl = tryAcquireImportLock(access.projectId, req.userId!, 'entries')
    if (!ctrl)
      throw new AppError(ErrCode.Conflict, '该项目正在导入中，请稍后再试')
    const raw = typeof body.data === 'string' ? body.data : JSON.stringify(body.data)
    runImportInBackground(ctrl, () => importKeys(access.projectId, raw, sniffFormat(raw), body.overwrite ?? false, ctrl))
    return ok({ accepted: true })
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
  public async importTranslations(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string, @Body() body: ImportTranslationsBody): Promise<ApiOk<{ accepted: true }>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    if (!body.formatType)
      throw new AppError(ErrCode.InvalidParams, 'formatType is required')
    const ctrl = tryAcquireImportLock(access.projectId, req.userId!, 'translations')
    if (!ctrl)
      throw new AppError(ErrCode.Conflict, '该项目正在导入中，请稍后再试')
    const raw = typeof body.data === 'string' ? body.data : JSON.stringify(body.data)
    runImportInBackground(ctrl, () => applyTranslations(access.projectId, raw, body.formatType, body.languageCode ?? '', body.overwrite ?? false, body.autoCreate ?? true, ctrl))
    return ok({ accepted: true })
  }

  /**
   * 中止当前项目的导入任务（同项目互斥：导入进行中其他导入会被拒绝，导入完成或中止后自动解锁）
   * @param req 请求对象
   * @param projectSlug 项目标识
   * @summary 中止导入
   */
  @Post('{projectSlug}/imports/abort')
  @Security('auth')
  public async abortImport(@Request() req: AuthRequest, @Path('projectSlug') projectSlug: string): Promise<ApiOk<{ aborted: boolean }>> {
    const access = await assertProjectAccess(req.userId!, req.userRole!, projectSlug, ProjectRole.Maintainer)
    const lock = getImportLock(access.projectId)
    if (!lock)
      throw new AppError(ErrCode.Conflict, '当前没有进行中的导入')
    if (lock.userId !== req.userId! && req.userRole! !== SystemRole.SuperAdmin)
      throw new AppError(ErrCode.Forbidden, '只能中止自己发起的导入')
    const okAbort = abortImport(access.projectId)
    if (!okAbort)
      throw new AppError(ErrCode.Conflict, '当前没有进行中的导入')
    return ok({ aborted: true })
  }
}

/** 项目导入状态 Row（getImportStatus 使用） */
export interface ImportStatusRow {
  /** 是否正有导入在跑 */
  locked: boolean
  /** 导入类型（entries 条目 / translations 译文；无导入时为空） */
  type: string
  /** 发起导入的用户 id（无导入时为空） */
  startUserId: string
  /** 发起导入的用户名（无导入时为空） */
  startUsername: string
  /** 发起导入的时间（无导入时为空） */
  startTimestamp: number
  /** 导入进度（有导入时为对象，否则为 null） */
  progress: ImportProgress | null
  /** 导入结果（导入已结束时为对象，否则为 null） */
  result: ImportResult | null
  /** 导入失败时的错误信息（导入已结束且 result 为 null 时存在） */
  error: string | null
}
