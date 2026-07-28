import type { ImportEntry } from './types'
import { load } from 'js-yaml'
import { FlatEntriesSchema } from './types'
import { parseFlatEntries, parseNestedEntries } from './utils'

export function yamlParse(data: string): ImportEntry[] {
  const parsed = load(data) as Record<string, unknown> | undefined
  if (!parsed || typeof parsed !== 'object')
    return []
  const flatResult = FlatEntriesSchema.safeParse(parsed)
  if (flatResult.success)
    return parseFlatEntries(flatResult.data)
  return parseNestedEntries(parsed)
}
