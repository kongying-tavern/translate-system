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

export interface SummaryStats { countTotal: number, countTranslated: number, ratioTranslated: number }
export interface LangSummary { langName: string, langCode: string, md5Hash: string, summary: SummaryStats }
