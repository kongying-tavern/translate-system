import type { ImportEntry } from './types'
import { load } from 'js-yaml'

export function yamlParse(data: string): ImportEntry[] {
  const parsed = load(data) as Record<string, unknown> | undefined
  if (!parsed || typeof parsed !== 'object')
    return []
  // Check if nested: { "zh-Hans": { "key": "val" }, "en-US": { "key": "val" } }
  const firstVal = Object.values(parsed)[0]
  if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
    const entries: ImportEntry[] = []
    for (const [lang, obj] of Object.entries(parsed)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const vo = value as Record<string, unknown>
          entries.push({ key, sourceText: (vo.sourceText as string) || key, translatedText: (vo.translatedText as string) || '', tags: (vo.tags as string[]) || [], context: (vo.context as string) || '', lang })
        }
        else {
          entries.push({ key, sourceText: key, translatedText: String(value || ''), tags: [], context: '', lang })
        }
      }
    }
    return entries
  }
  // Flat: { "key": "val" }
  return Object.entries(parsed).map(([key, value]: [string, unknown]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const vo = value as Record<string, unknown>
      return { key, sourceText: (vo.sourceText as string) || key, translatedText: (vo.translatedText as string) || '', tags: (vo.tags as string[]) || [], context: (vo.context as string) || '' }
    }
    return { key, sourceText: key, translatedText: String(value || ''), tags: [], context: '' }
  })
}
