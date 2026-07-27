import type { Prisma } from '@prisma/client'

export type ExportKey = Prisma.TranslationKeyGetPayload<{ include: { values: true } }>

export interface FlatTranslation {
  translationKey: string
  languageCode: string
  sourceText: string
  translatedText: string
  alias?: string
}

export interface XmlString { '@_name': string, '#text': string }
export interface XmlLanguage { '@_code': string, 'string': XmlString | XmlString[] }
