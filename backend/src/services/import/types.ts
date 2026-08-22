import { z } from 'zod'

export interface ImportEntry {
  key: string
  sourceText: string
  translatedText: string
  tags: string[]
  context: string
  lang?: string
}

export interface FlatEntryValue {
  sourceText?: string
  translatedText?: string
  tags?: string[]
  context?: string
}

export const FlatEntryValueSchema = z.object({
  sourceText: z.string().optional(),
  translatedText: z.string().optional(),
  tags: z.array(z.string()).optional(),
  context: z.string().optional(),
}).strict()
