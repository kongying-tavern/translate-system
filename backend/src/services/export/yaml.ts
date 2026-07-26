import type { FlatTranslation } from './types'
import yaml from 'js-yaml'
import { getLangKey } from './types'

export function exportFlatYAML(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const items: Record<string, string> = {}
  for (const t of translations) {
    if (t.languageCode === lang)
      items[t.translationKey] = t.translatedText
  }
  return yaml.dump(items, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}

export function exportNestedYAML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    result[name] = {}
    for (const t of translations) {
      if (t.languageCode === lang)
        result[name][t.translationKey] = t.translatedText
    }
  }
  return yaml.dump(result, { noRefs: true, quotingType: '"', forceQuotes: false, lineWidth: -1 })
}
