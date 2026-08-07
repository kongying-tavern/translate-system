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
  /** 导入总数 */
  imported: number
  /** 新建数量 */
  created: number
  /** 跳过数量 */
  skipped: number
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

function parseImportData(raw: string, fmt: string): ImportEntry[] {
  let entries: ImportEntry[]
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
  if (!entries.length)
    throw new AppError(ErrCode.InvalidParams, '未从数据中解析到任何条目，请检查文件格式与内容')
  const bad = entries.findIndex(e => !e.key || !e.key.trim())
  if (bad !== -1)
    throw new AppError(ErrCode.InvalidParams, `第 ${bad + 1} 条缺少翻译键（key/name），已拒绝导入`)
  return entries
}

async function importKeys(projectId: string, raw: string, fmt: ImportFormat, overwrite: boolean): Promise<ImportResult> {
  const entries = parseImportData(raw, fmt)
  const sourceLang = (await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } }))?.sourceLanguage || ''
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, context, tags } = entry
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key } } })
    const keyExisted = !!tk
    if (keyExisted && !overwrite) {
      skipped++
    }
    else {
      if (!tk) {
        const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
        tk = await prisma.translationKey.create({ data: { projectId, key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
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
      // 原文 = sourceText 或源语言列，等价于源语言的翻译更新
      if (sourceLang) {
        let sourceVal: string | undefined
        if (entry.sourceText && entry.sourceText !== key)
          sourceVal = entry.sourceText
        if (sourceVal === undefined && entry.lang === sourceLang && entry.translatedText)
          sourceVal = entry.translatedText
        if (sourceVal !== undefined) {
          await prisma.translationValue.upsert({
            where: { keyId_languageCode: { keyId: tk.id, languageCode: sourceLang } },
            update: { translatedText: sourceVal },
            create: { keyId: tk.id, languageCode: sourceLang, translatedText: sourceVal },
          })
        }
      }
      created++
    }
    imported++
  }
  return { imported, created, skipped, skippedLanguages: [] }
}

async function applyTranslations(projectId: string, raw: string, fmt: string, languageCode: string, overwrite: boolean, autoCreate: boolean): Promise<ImportResult> {
  const entries = parseImportData(raw, fmt)
  const projectLangs = await prisma.projectLanguage.findMany({ where: { projectId }, select: { languageCode: true, alias: true } })
  const knownLangs = new Set<string>()
  for (const l of projectLangs) {
    knownLangs.add(l.languageCode)
    if (l.alias)
      knownLangs.add(l.alias)
  }
  const unknownLangs = new Set<string>()
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, translatedText, context, tags, lang } = entry
    const langCode = lang || languageCode
    if (langCode && !knownLangs.has(langCode)) {
      unknownLangs.add(langCode)
      skipped++
      imported++
      continue
    }
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key } } })
    if (!tk && autoCreate !== false) {
      const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
      tk = await prisma.translationKey.create({ data: { projectId, key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
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
  return { imported, created, skipped, skippedLanguages: [...unknownLangs] }
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
