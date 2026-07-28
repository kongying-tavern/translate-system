import type { FlatEntryValue, ImportEntry } from './types'

export function parseFlatEntries(data: Record<string, string | FlatEntryValue>): ImportEntry[] {
  return Object.entries(data).map(([key, value]) => {
    if (typeof value === 'object') {
      const v = value as FlatEntryValue
      return { key, sourceText: v.sourceText || key, translatedText: v.translatedText ?? '', tags: v.tags ?? [], context: v.context ?? '' }
    }
    return { key, sourceText: key, translatedText: String(value ?? ''), tags: [], context: '' }
  })
}

export function parseNestedEntries(data: Record<string, unknown>): ImportEntry[] {
  const entries: ImportEntry[] = []
  for (const [lang, obj] of Object.entries(data)) {
    if (!obj || typeof obj !== 'object')
      continue
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
