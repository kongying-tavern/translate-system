import type { FlatTranslation } from './types'
import { getLangKey, groupByLanguage } from './utils'

export function exportFlatJSON(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return '{}'
  const grouped = groupByLanguage(translations)
  return JSON.stringify(grouped[langs[0]] || {})
}

export function exportNestedJSON(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const grouped = groupByLanguage(translations)
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey({ languageCode: lang, codeAlias: translations.find(t => t.languageCode === lang)?.codeAlias }, config)
    result[name] = grouped[lang] || {}
  }
  return JSON.stringify(result)
}
