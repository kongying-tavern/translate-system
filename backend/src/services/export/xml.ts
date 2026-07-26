import type { FlatTranslation, XmlLanguage, XmlString } from './types'
import { XMLBuilder } from 'fast-xml-parser'
import { getLangKey } from './types'

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
  const strings: XmlString[] = []
  for (const t of translations) {
    if (t.languageCode === lang)
      strings.push({ '@_name': t.translationKey, '#text': t.translatedText })
  }
  return builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, 'resources': { string: strings.length === 1 ? strings[0] : strings } })
}

export function exportNestedXML(translations: FlatTranslation[], langs: string[], config?: Record<string, unknown>) {
  const builder = new XMLBuilder({
    format: true,
    indentBy: '  ',
    ignoreAttributes: false,
    suppressEmptyNode: true,
  })
  const resources: { language: XmlLanguage[] } = { language: [] }
  for (const lang of langs) {
    const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config)
    const strings: XmlString[] = []
    for (const t of translations) {
      if (t.languageCode === lang)
        strings.push({ '@_name': t.translationKey, '#text': t.translatedText })
    }
    resources.language.push({ '@_code': name, 'string': strings.length === 1 ? strings[0] : strings })
  }
  const xml = builder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, resources })
  return xml
}
