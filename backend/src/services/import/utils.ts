import type { FlatEntryValue, ImportEntry } from './types'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'
import { FlatEntriesSchema } from './types'

export function parseFlatEntries(data: Record<string, string | FlatEntryValue>): ImportEntry[] {
  return Object.entries(data).map(([key, value]) => {
    if (typeof value === 'object') {
      const v = value as FlatEntryValue
      return { key, sourceText: v.sourceText || key, translatedText: v.translatedText ?? '', tags: v.tags ?? [], context: v.context ?? '' }
    }
    return { key, sourceText: key, translatedText: String(value ?? ''), tags: [], context: '' }
  })
}

/** 判断字符串是否像语言代码（如 zh-Hans / en_US / ja），用于区分「语言→Key→译文」嵌套结构与扁平条目 */
function looksLikeLang(s: string): boolean {
  return /^[a-z]{2,3}(?:[_-][a-z0-9]+)*$/i.test(s.trim())
}

export function parseNestedEntries(data: Record<string, unknown>): ImportEntry[] {
  const entries: ImportEntry[] = []
  for (const [lang, obj] of Object.entries(data)) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
      throw new AppError(ErrCode.InvalidParams, `语言组「${lang}」的值必须是键值映射对象（{ key: text }），无法解析`)
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const vo = v as Record<string, unknown>
        entries.push({ key: k, sourceText: (vo.sourceText as string) || k, translatedText: (vo.translatedText as string) ?? '', tags: (vo.tags as string[]) ?? [], context: (vo.context as string) ?? '', lang })
      }
      else {
        entries.push({ key: k, sourceText: k, translatedText: String(v ?? ''), tags: [], context: '', lang })
      }
    }
  }
  return entries
}

/**
 * 解析 JSON/YAML 键值结构：先按扁平条目（key → text/条目对象）严格校验；
 * 失败时若外层键都像语言代码，再按「语言 → Key → 译文」嵌套结构解析；
 * 否则拒绝导入并定位到有问题的条目，避免产生空 key 或字段名充当 key 的脏数据。
 */
export function parseStructured(data: Record<string, unknown>): ImportEntry[] {
  const flatResult = FlatEntriesSchema.safeParse(data)
  if (flatResult.success)
    return parseFlatEntries(flatResult.data)

  const keys = Object.keys(data)
  if (keys.length && keys.every(k => looksLikeLang(k)))
    return parseNestedEntries(data)

  const bad = keys.find((k) => {
    const v = data[k]
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  })
  throw new AppError(ErrCode.InvalidParams, `条目「${bad ?? keys[0]}」不是合法的翻译条目（字段仅支持 sourceText/translatedText/tags/context），请检查数据格式`)
}
