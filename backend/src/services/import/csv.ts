import type { ImportEntry } from './types'

export function csvParse(data: string): ImportEntry[] {
  const lines = data.split('\n').filter(l => l.trim())
  if (!lines.length)
    return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const entries: ImportEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    const entry: Partial<ImportEntry> & { key?: string } = { tags: [], context: '' }
    headers.forEach((h, idx) => {
      if (h === 'key')
        entry.key = vals[idx]
      else if (h === 'sourcetext' || h === 'source_text')
        entry.sourceText = vals[idx]
      else if (h === 'translatedtext' || h === 'translated_text')
        entry.translatedText = vals[idx]
      else if (h === 'tags' && vals[idx])
        entry.tags = vals[idx].split(';').map((t: string) => t.trim())
      else if (h === 'context')
        entry.context = vals[idx]
    })
    if (entry.key) {
      entry.sourceText = entry.sourceText || entry.key
      entries.push(entry as ImportEntry)
    }
  }
  return entries
}

function parseCSVLine(line: string) {
  const r: string[] = []
  let c = ''
  let q = false
  for (const ch of line) {
    if (q) {
      if (ch === '"') {
        q = false
      }
      else {
        c += ch
      }
    }
    else if (ch === '"') {
      q = true
    }
    else if (ch === ',') {
      r.push(c.trim())
      c = ''
    }
    else {
      c += ch
    }
  }
  r.push(c.trim())
  return r
}
