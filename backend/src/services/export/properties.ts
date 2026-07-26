import type { FlatTranslation } from './types'

export function exportProperties(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const lines: string[] = []
  for (const t of translations) {
    if (t.languageCode === lang)
      lines.push(`${propsEscapeKey(t.translationKey)}=${propsEscapeValue(t.translatedText)}`)
  }
  return lines.join('\n')
}

function propsEscapeKey(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/[=:]/g, '\\$&').replace(/^[#!]/gm, '\\$&')
}

function propsEscapeValue(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/^[#!]/gm, '\\$&').replace(/[=:]/g, '\\$&')
}
