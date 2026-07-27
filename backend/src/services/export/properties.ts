import type { FlatTranslation } from './types'
import { groupByLanguage } from './utils'

export function exportProperties(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const grouped = groupByLanguage(translations)
  const lines: string[] = []
  for (const [key, text] of Object.entries(grouped[lang] || {}))
    lines.push(`${propsEscapeKey(key)}=${propsEscapeValue(text)}`)
  return lines.join('\n')
}

function propsEscapeKey(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/[=:]/g, '\\$&').replace(/^[#!]/gm, '\\$&')
}

function propsEscapeValue(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/^[#!]/gm, '\\$&').replace(/[=:]/g, '\\$&')
}
