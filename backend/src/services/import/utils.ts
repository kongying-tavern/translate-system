import type { FlatEntryValue, ImportEntry } from './types'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'
import { FlatEntryValueSchema } from './types'

/** 单个 value 是否符合扁平条目结构（字符串，或仅含 sourceText/translatedText/tags/context 的条目对象） */
function isFlatValue(v: unknown): boolean {
  if (typeof v === 'string')
    return true
  if (v === null || typeof v !== 'object' || Array.isArray(v))
    return false
  return FlatEntryValueSchema.safeParse(v).success
}

/** 扁平条目构建：value 为字符串时原文/译文同键，对象时取各字段 */
function buildFlatEntry(key: string, value: unknown): ImportEntry {
  if (typeof value === 'object' && value !== null) {
    const v = value as FlatEntryValue
    return { key, sourceText: v.sourceText || key, translatedText: v.translatedText ?? '', tags: v.tags ?? [], context: v.context ?? '' }
  }
  return { key, sourceText: key, translatedText: String(value ?? ''), tags: [], context: '' }
}

/** 判断字符串是否像语言代码（如 zh-Hans / en_US / ja），用于区分「语言→Key→译文」嵌套结构与扁平条目 */
function looksLikeLang(s: string): boolean {
  return /^[a-z]{2,3}(?:[_-][a-z0-9]+)*$/i.test(s.trim())
}

/** 「语言 → Key → 译文」嵌套结构逐条产出 */
function* parseNestedEntries(data: Record<string, unknown>): Generator<ImportEntry> {
  for (const [lang, obj] of Object.entries(data)) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
      throw new AppError(ErrCode.InvalidParams, `语言组「${lang}」的值必须是键值映射对象（{ key: text }），无法解析`)
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const vo = v as Record<string, unknown>
        yield { key: k, sourceText: (vo.sourceText as string) || k, translatedText: (vo.translatedText as string) ?? '', tags: (vo.tags as string[]) ?? [], context: (vo.context as string) ?? '', lang }
      }
      else {
        yield { key: k, sourceText: k, translatedText: String(v ?? ''), tags: [], context: '', lang }
      }
    }
  }
}

/**
 * JSON/YAML 键值结构的流式解析：先做轻量结构判定——所有顶层 value 均为扁平条目则按扁平产出，
 * 否则外层键都像语言代码时按「语言 → Key → 译文」嵌套产出；两类结构均不匹配即拒绝导入并定位问题条目，
 * 避免产生空 key 或字段名充当 key 的脏数据。生成器逐条产出，不物化条目数组；
 * 结构判定需完整顶层键集，JSON.parse / js-yaml load 的对象树仍整体存在。
 */
export function* parseStructured(data: Record<string, unknown>): Generator<ImportEntry> {
  const keys = Object.keys(data)

  // 空对象的 every 恒真，自然落入扁平分支产出空序列，由上层「未解析到任何条目」统一报错
  if (keys.every(k => isFlatValue(data[k]))) {
    for (const [k, v] of Object.entries(data))
      yield buildFlatEntry(k, v)
    return
  }

  if (keys.every(k => looksLikeLang(k))) {
    yield* parseNestedEntries(data)
    return
  }

  const bad = keys.find((k) => {
    const v = data[k]
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  })
  throw new AppError(ErrCode.InvalidParams, `条目「${bad ?? keys[0]}」不是合法的翻译条目（字段仅支持 sourceText/translatedText/tags/context），请检查数据格式`)
}
