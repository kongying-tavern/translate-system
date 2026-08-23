import type { FlatTranslation } from './types'
import yaml from 'js-yaml'
import { getLangKey, groupByLanguage } from './utils'

export function exportFlatYAML(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const grouped = groupByLanguage(translations)
  return yaml.dump(grouped[langs[0]] || {}, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}

export function exportNestedYAML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const grouped = groupByLanguage(translations)
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey({ languageCode: lang, codeAlias: translations.find(t => t.languageCode === lang)?.codeAlias }, config)
    result[name] = grouped[lang] || {}
  }
  return yaml.dump(result, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}
