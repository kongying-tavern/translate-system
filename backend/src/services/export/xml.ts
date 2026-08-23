import type { FlatTranslation, XmlLanguage, XmlString } from './types'
import { XMLBuilder } from 'fast-xml-parser'
import { getLangKey, groupByLanguage } from './utils'

export function exportFlatXML(translations: FlatTranslation[], langs: string[], _config?: Record<string, unknown>) {
  if (!langs.length)
    return ''
  const lang = langs[0]
  const builder = new XMLBuilder({
    format: true,
    indentBy: '    ',
    ignoreAttributes: false,
    suppressEmptyNode: true,
  })
  const grouped = groupByLanguage(translations)
  const strings: XmlString[] = Object.entries(grouped[lang] || {}).map(([key, text]) => ({ '@_name': key, '#text': text }))
  return builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, 'resources': { string: strings.length === 1 ? strings[0] : strings } })
}

export function exportNestedXML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const builder = new XMLBuilder({
    format: true,
    indentBy: '  ',
    ignoreAttributes: false,
    suppressEmptyNode: true,
  })
  const grouped = groupByLanguage(translations)
  const resources: { language: XmlLanguage[] } = { language: [] }
  for (const lang of langs) {
    const name = getLangKey({ languageCode: lang, codeAlias: translations.find(t => t.languageCode === lang)?.codeAlias }, config)
    const strings: XmlString[] = Object.entries(grouped[lang] || {}).map(([key, text]) => ({ '@_name': key, '#text': text }))
    resources.language.push({ '@_code': name, 'string': strings.length === 1 ? strings[0] : strings })
  }
  const xml = builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, resources })
  return xml
}
