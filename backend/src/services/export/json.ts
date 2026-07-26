import type { ExportKey, FlatTranslation, LangSummary } from './types'
import crypto from 'node:crypto'
import { getLangKey } from './types'

export function exportFlatJSON(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return '{}'
  const lang = langs[0]
  const items: Record<string, string> = {}
  for (const t of translations) {
    if (t.languageCode === lang)
      items[t.translationKey] = t.translatedText
  }
  return JSON.stringify(items)
}

export function exportNestedJSON(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const result: Record<string, Record<string, string>> = {}
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    result[name] = {}
    for (const t of translations) {
      if (t.languageCode === lang)
        result[name][t.translationKey] = t.translatedText
    }
  }
  return JSON.stringify(result)
}

export function exportSummaryJSON(keys: ExportKey[], languageCodes: string[], aliases?: Record<string, string>) {
  const result: LangSummary[] = []
  for (const lang of languageCodes) {
    let countTotal = 0
    let countTranslated = 0
    const texts: string[] = []
    for (const k of keys) {
      countTotal++
      const v = k.values.find(v => v.languageCode === lang)
      const t = v?.translatedText
      if (t) {
        countTranslated++
        texts.push(t)
      }
    }
    texts.sort()
    const md5Hash = crypto.createHash('md5').update(texts.join('')).digest('hex')
    result.push({
      langName: aliases?.[lang] || lang,
      langCode: lang,
      md5Hash,
      summary: {
        countTotal,
        countTranslated,
        ratioTranslated: countTotal > 0 ? Number((countTranslated / countTotal * 100).toFixed(8)) : 0,
      },
    })
  }
  return JSON.stringify(result)
}
