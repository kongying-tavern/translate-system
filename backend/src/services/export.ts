import type { Prisma } from '@prisma/client'
import { XMLBuilder } from 'fast-xml-parser'
import yaml from 'js-yaml'
import { prisma } from '../index'
import { AppError } from '../utils/AppError'

type ExportKey = Prisma.TranslationKeyGetPayload<{ include: { values: true } }>

interface XmlString { '@_name': string, '#text': string }
interface XmlLanguage { '@_code': string, 'string': XmlString | XmlString[] }

interface FlatTranslation {
  translationKey: string
  languageCode: string
  sourceText: string
  translatedText: string
  alias?: string
}

export async function listTemplates(projectId: string) {
  return prisma.exportTemplate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}

export async function getTemplate(id: string, projectId?: string) {
  let t = null
  try {
    t = await prisma.exportTemplate.findUnique({ where: { id } })
  }
  catch {}
  if (!t && projectId)
    t = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId, code: id } } })
  if (!t)
    throw new AppError(1003, 'template not found')
  return t
}

export async function createTemplate(projectId: string, data: Omit<Prisma.ExportTemplateUncheckedCreateInput, 'id' | 'projectId'>) {
  if (!data.code)
    throw new AppError(1001, 'code is required')
  const existing = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId, code: data.code } } })
  if (existing)
    throw new AppError(1004, 'code already exists')
  return prisma.exportTemplate.create({ data: { projectId, ...data, config: data.config || {} } })
}

export async function updateTemplate(id: string, data: Prisma.ExportTemplateUncheckedUpdateInput) {
  const code = typeof data.code === 'string' ? data.code : undefined
  if (code) {
    const t = await prisma.exportTemplate.findUnique({ where: { id } })
    if (t && code !== t.code) {
      const existing = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId: t.projectId, code } } })
      if (existing)
        // eslint-disable-next-line no-throw-literal
        throw { code: 1004, message: 'code already exists' }
    }
  }
  return prisma.exportTemplate.update({ where: { id }, data })
}

export async function deleteTemplate(id: string) {
  return prisma.exportTemplate.delete({ where: { id } })
}

function flattenKeys(keys: ExportKey[], languageCodes: string[], aliases?: Record<string, string>) {
  const result: FlatTranslation[] = []
  for (const k of keys) {
    for (const lang of languageCodes) {
      const v = k.values.find(v => v.languageCode === lang)
      result.push({ translationKey: k.key, languageCode: lang, sourceText: k.sourceText, translatedText: v?.translatedText || '', alias: aliases?.[lang] })
    }
  }
  return result
}

export function exportTranslations(keys: ExportKey[], languageCodes: string[], formatType: string, aliases?: Record<string, string>, config?: Record<string, unknown>, filterTags?: string[]): [string, string] | [string, string, string] {
  if (filterTags?.length) {
    keys = keys.filter(k => filterTags.some(t => k.tags?.includes(t)))
  }
  let translations = flattenKeys(keys, languageCodes, aliases)
  if (config?.skipIdentical) {
    translations = translations.filter(t => t.translatedText !== t.translationKey)
  }
  if (config?.skipEmpty) {
    translations = translations.filter(t => t.translatedText)
  }
  switch (formatType) {
    case 'flat-json': return [exportFlatJSON(translations, languageCodes, config), 'json']
    case 'nested-json': return [exportNestedJSON(translations, languageCodes, config), 'json']
    case 'flat-yaml': return [exportFlatYAML(translations, languageCodes, config), 'yaml']
    case 'nested-yaml': return [exportNestedYAML(translations, languageCodes, config), 'yaml']
    case 'properties': return [exportProperties(translations, languageCodes, config), 'properties']
    case 'flat-xml': return [exportFlatXML(translations, languageCodes, config), 'xml']
    case 'nested-xml': return [exportNestedXML(translations, languageCodes, config), 'xml']
    case 'csv': return [exportCSV(translations, languageCodes, config), 'csv']
    default: return [exportFlatJSON(translations, languageCodes, config), 'json']
  }
}

function getLangKey(t: { languageCode: string, alias?: string }, config?: Record<string, unknown>) {
  return config?.useCodeKey ? t.languageCode : (t.alias || t.languageCode)
}

function exportFlatJSON(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return '{}'
  const lang = langs[0]
  const items: Record<string, string> = {}
  for (const t of translations) {
    if (t.languageCode === lang)
      items[t.translationKey] = t.translatedText
  }
  return JSON.stringify(items, null, 2)
}

function exportNestedJSON(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    result[name] = {}
    for (const t of translations) {
      if (t.languageCode === lang)
        result[name][t.translationKey] = t.translatedText
    }
  }
  return JSON.stringify(result, null, 2)
}

function exportFlatYAML(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const items: Record<string, string> = {}
  for (const t of translations) {
    if (t.languageCode === lang)
      items[t.translationKey] = t.translatedText
  }
  return yaml.dump(items, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}

function exportNestedYAML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    result[name] = {}
    for (const t of translations) {
      if (t.languageCode === lang)
        result[name][t.translationKey] = t.translatedText
    }
  }
  return yaml.dump(result, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}

function exportProperties(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const lines: string[] = []
  for (const t of translations) {
    if (t.languageCode === lang)
      lines.push(`${propsEscapeKey(t.translationKey)}=${propsEscapeValue(t.translatedText)}`)
  }
  return lines.join('\n')
}

function propsEscapeKey(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/[=:]/g, '\\$&').replace(/^[#!]/gm, '\\$&')
}
function propsEscapeValue(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/^[#!]/gm, '\\$&').replace(/[=:]/g, '\\$&')
}

function exportFlatXML(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const builder = new XMLBuilder({
    format: true,
    indentBy: '    ',
    ignoreAttributes: false,
    suppressEmptyNode: true,
  })
  const strings: XmlString[] = []
  for (const t of translations) {
    if (t.languageCode === lang)
      strings.push({ '@_name': t.translationKey, '#text': t.translatedText })
  }
  return builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, 'resources': { string: strings.length === 1 ? strings[0] : strings } })
}

function exportNestedXML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const builder = new XMLBuilder({
    format: true,
    indentBy: '  ',
    ignoreAttributes: false,
    suppressEmptyNode: true,
  })
  const resources: { language: XmlLanguage[] } = { language: [] }
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    const strings: XmlString[] = []
    for (const t of translations) {
      if (t.languageCode === lang)
        strings.push({ '@_name': t.translationKey, '#text': t.translatedText })
    }
    resources.language.push({ '@_code': name, 'string': strings.length === 1 ? strings[0] : strings })
  }
  const xml = builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, resources })
  return xml
}

function exportCSV(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const rows: Record<string, { source: string, langs: Record<string, string> }> = {}
  for (const t of translations) {
    if (!rows[t.translationKey])
      rows[t.translationKey] = { source: t.sourceText, langs: {} }
    rows[t.translationKey].langs[t.languageCode] = t.translatedText
  }
  const headerNames = langs.map(l => getLangKey(translations.find(t => t.languageCode === l) || { languageCode: l }, config))
  const header = [csvEscape('key'), csvEscape('source'), ...headerNames.map(csvEscape)].join(',')
  const lines = [header]
  for (const [key, row] of Object.entries(rows)) {
    lines.push([csvEscape(key), csvEscape(row.source), ...langs.map(l => csvEscape(row.langs[l] || ''))].join(','))
  }
  return lines.join('\n')
}

function csvEscape(s: string) {
  if (/[,"\n\r]/.test(s))
    return `"${s.replace(/"/g, '""')}"`
  return s
}
