import type { ImportEntry } from './types'

export function flatJSONParse(data: Record<string, unknown>, _languageCode: string): ImportEntry[] {
  // Detect nested: { "zh-Hans": { "key": "val" } } → flatten with lang
  const firstVal = Object.values(data)[0]
  if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal) && !('translatedText' in (firstVal as Record<string, unknown>)) && !('sourceText' in (firstVal as Record<string, unknown>))) {
    const entries: ImportEntry[] = []
    for (const [lang, obj] of Object.entries(data)) {
      if (!obj || typeof obj !== 'object')
        continue
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const vo = v as Record<string, unknown>
          entries.push({ key: k, sourceText: (vo.sourceText as string) || k, translatedText: (vo.translatedText as string) || '', tags: (vo.tags as string[]) || [], context: (vo.context as string) || '', lang })
        }
        else {
          entries.push({ key: k, sourceText: k, translatedText: String(v || ''), tags: [], context: '', lang })
        }
      }
    }
    return entries
  }
  // Flat: { "key": "val" } or { "key": { sourceText, tags, ... } }
  return Object.entries(data).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const vo = value as Record<string, unknown>
      return { key, sourceText: (vo.sourceText as string) || key, translatedText: (vo.translatedText as string) || '', tags: (vo.tags as string[]) || [], context: (vo.context as string) || '' }
    }
    return { key, sourceText: key, translatedText: String(value || ''), tags: [], context: '' }
  })
}
