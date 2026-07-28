import type { ImportEntry } from './types'

export function propertiesParse(data: string): ImportEntry[] {
  const entries: ImportEntry[] = []
  for (const line of data.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('!'))
      continue
    const eq = t.indexOf('=')
    if (eq === -1)
      continue
    entries.push({ key: t.substring(0, eq).trim(), sourceText: t.substring(0, eq).trim(), translatedText: t.substring(eq + 1).trim(), tags: [], context: '' })
  }
  return entries
}
