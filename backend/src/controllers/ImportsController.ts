import type { Prisma } from '@prisma/client'
import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import type { ImportEntry } from '../services/import/types'
import { Body, Controller, Path, Post, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ProjectRole } from '../constants/roles'
import { assertProjectAccess } from '../lib/access'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { ImportFormat } from '../lib/formats'
import { prisma } from '../lib/prisma'
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
}

export interface ImportEntriesBody {
  /** 导入数据 */
  data: string | Record<string, unknown>
  /** 覆盖已有Key */
  overwrite?: boolean
}

export interface ImportTranslationsBody {
  /** 目标语言代码 */
  languageCode?: string
  /** 数据格式类型 */
  formatType: string
  /** 导入数据 */
  data: string | Record<string, unknown>
  /** 覆盖已有译文 */
  overwrite?: boolean
  /** 自动创建Key */
  autoCreate?: boolean
}

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

async function importKeys(projectId: string, raw: string, fmt: ImportFormat, overwrite: boolean): Promise<ImportResult> {
  const entries = parseImportData(raw, fmt)
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, context, tags, sourceText } = entry
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key } } })
    const keyExisted = !!tk
    if (keyExisted && !overwrite) {
      skipped++
    }
    else {
      if (!tk) {
        const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
        tk = await prisma.translationKey.create({ data: { projectId, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
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

async function applyTranslations(projectId: string, raw: string, fmt: string, languageCode: string, overwrite: boolean, autoCreate: boolean): Promise<ImportResult> {
  const entries = parseImportData(raw, fmt)
  let imported = 0
  let created = 0
  let skipped = 0
  for (const entry of entries) {
    const { key, translatedText, context, tags, sourceText, lang } = entry
    const langCode = lang || languageCode
    let tk = await prisma.translationKey.findUnique({ where: { projectId_key: { projectId, key } } })
    if (!tk && autoCreate !== false) {
      const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
      tk = await prisma.translationKey.create({ data: { projectId, key, sourceText: sourceText || key, context: context || '', tags: tags || [], sortOrder: (maxSo._max.sortOrder || 0) + 100 } })
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

@Route('projects')
@Tags('Imports')
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
