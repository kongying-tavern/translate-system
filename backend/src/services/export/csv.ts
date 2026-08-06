import type { FlatTranslation } from './types'
import { getLangKey } from './utils'

export function exportCSV(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const rows: Record<string, { source: string, langs: Record<string, string> }> = {}
  for (const t of translations) {
    if (!rows[t.translationKey])
      rows[t.translationKey] = { source: t.sourceText, langs: {} }
    rows[t.translationKey].langs[t.languageCode] = t.translatedText
  }
  const headerNames = langs.map(l => getLangKey(translations.find(t => t.languageCode === l) || { languageCode: l }, config))
  const header = [csvEscape('key'), csvEscape('sourceText'), ...headerNames.map(csvEscape)].join(',')
  const lines = [header]
  for (const [key, row] of Object.entries(rows)) {
    lines.push([csvEscape(key), csvEscape(row.source), ...langs.map(l => csvEscape(row.langs[l] || ''))].join(','))
  }
  return lines.join('\n')
}

function csvEscape(s: string) {
  if (/[,"\n\r]/.test(s))
    return `"${s.replace(/"/g, '""')}"`
  return s
}
