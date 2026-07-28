import type { ImportEntry } from './types'
import { XMLParser } from 'fast-xml-parser'

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

function parseString(s: RawString): ImportEntry {
  return {
    key: s['@_name'] ?? '',
    sourceText: s['@_sourceText'] || s['@_name'] || '',
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
    for (const s of toArray(lang.string)) {
      entries.push({ ...parseString(s), lang: langCode })
    }
  }
  return entries
}

export function xmlParse(data: string): ImportEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(data) as RawDoc
  const root = doc?.resources
  if (!root)
    return []

  const langs = toArray(root.language)
  if (langs.length)
    return parseNestedXml(root)

  return parseFlatXml(root)
}
