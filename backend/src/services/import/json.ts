import type { ImportEntry } from './types'
import { FlatEntriesSchema } from './types'
import { parseFlatEntries, parseNestedEntries } from './utils'

export function JSONParse(raw: string): ImportEntry[] {
  const data = JSON.parse(raw) as Record<string, unknown>
  const flatResult = FlatEntriesSchema.safeParse(data)
  if (flatResult.success)
    return parseFlatEntries(flatResult.data)
  return parseNestedEntries(data)
}
