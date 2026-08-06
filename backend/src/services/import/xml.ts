import type { ImportEntry } from './types'
import { XMLParser } from 'fast-xml-parser'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'

interface RawString {
  '@_name'?: string
  '@_sourceText'?: string
  '@_tags'?: string
  '@_context'?: string
  '#text'?: string
}

interface RawLanguage {
  '@_code'?: string
  'string'?: RawString | RawString[]
}

interface RawDoc {
  resources?: {
    string?: RawString | RawString[]
    language?: RawLanguage | RawLanguage[]
  }
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v == null)
    return []
  return Array.isArray(v) ? v : [v]
}

function parseString(s: RawString, index: number): ImportEntry {
  const name = s['@_name']
  if (!name || !name.trim())
    throw new AppError(ErrCode.InvalidParams, `XML 第 ${index + 1} 个 <string> 缺少 name 属性（翻译键），已拒绝导入`)
  return {
    key: name,
    sourceText: s['@_sourceText'] || name,
    translatedText: s['#text']?.trim() ?? '',
    tags: s['@_tags'] ? s['@_tags'].split(';').map(t => t.trim()) : [],
    context: s['@_context'] ?? '',
  }
}

function parseFlatXml(root: Exclude<RawDoc['resources'], undefined>): ImportEntry[] {
  return toArray(root.string).map(parseString)
}

function parseNestedXml(root: Exclude<RawDoc['resources'], undefined>): ImportEntry[] {
  const entries: ImportEntry[] = []
  for (const lang of toArray(root.language)) {
    const langCode = lang['@_code'] ?? ''
    if (!langCode)
      throw new AppError(ErrCode.InvalidParams, 'XML <language> 缺少 code 属性（语言代码），已拒绝导入')
    toArray(lang.string).forEach((s, i) => entries.push({ ...parseString(s, i), lang: langCode }))
  }
  return entries
}

export function xmlParse(data: string): ImportEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(data) as RawDoc
  const root = doc?.resources
  if (!root)
    throw new AppError(ErrCode.InvalidParams, '未找到 <resources> 根节点，请检查 XML 结构')
  return toArray(root.language).length ? parseNestedXml(root) : parseFlatXml(root)
}
