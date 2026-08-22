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

function* parseFlatXml(root: Exclude<RawDoc['resources'], undefined>): Generator<ImportEntry> {
  const strings = toArray(root.string)
  for (let i = 0; i < strings.length; i++)
    yield parseString(strings[i], i)
}

function* parseNestedXml(root: Exclude<RawDoc['resources'], undefined>): Generator<ImportEntry> {
  for (const lang of toArray(root.language)) {
    const langCode = lang['@_code'] ?? ''
    if (!langCode)
      throw new AppError(ErrCode.InvalidParams, 'XML <language> 缺少 code 属性（语言代码），已拒绝导入')
    const strings = toArray(lang.string)
    for (let i = 0; i < strings.length; i++)
      yield { ...parseString(strings[i], i), lang: langCode }
  }
}

/**
 * XML 流式解析：fast-xml-parser 整体建 DOM 后按 flat/nested 结构以生成器逐条产出（不物化条目数组）。
 * 返回可重复迭代的 Iterable——每次迭代从同一棵 DOM 重建新生成器，供「校验遍历 → 写入遍历」两轮消费；
 * 校验抛错即全量拒绝。
 */
export function xmlParse(data: string): Iterable<ImportEntry> {
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(data) as RawDoc
  const root = doc?.resources
  if (!root)
    throw new AppError(ErrCode.InvalidParams, '未找到 <resources> 根节点，请检查 XML 结构')
  return {
    [Symbol.iterator]: () =>
      toArray(root.language).length ? parseNestedXml(root) : parseFlatXml(root),
  }
}
