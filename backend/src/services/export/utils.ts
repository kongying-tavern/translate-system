import type { FlatTranslation } from './types'

export function getLangKey(t: { languageCode: string, codeAlias?: string }, config?: Record<string, unknown>) {
  return config?.useCodeKey ? t.languageCode : (t.codeAlias || t.languageCode)
}

export function groupByLanguage(translations: FlatTranslation[]): Record<string, Record<string, string>> {
  const grouped: Record<string, Record<string, string>> = {}
  for (const t of translations) {
    ;(grouped[t.languageCode] ??= {})[t.translationKey] = t.translatedText
  }
  return grouped
}
