import type { ImportEntry } from './types'

interface ColumnDef {
  idx: number
  role: 'key' | 'sourceText' | 'tags' | 'context' | 'lang'
  langCode?: string
}

function csvSplit(data: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  while (i < data.length) {
    const ch = data[i]
    if (quoted) {
      if (ch === '"') {
        if (data[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      }
      else {
        field += ch
      }
    }
    else if (ch === '"') {
      quoted = true
    }
    else if (ch === ',') {
      fields.push(field)
      field = ''
    }
    else if (ch === '\n') {
      fields.push(field)
      field = ''
      records.push(fields)
      fields = []
    }
    else {
      field += ch
    }
    i++
  }
  fields.push(field)
  if (fields.some(f => f.trim()))
    records.push(fields)
  return records
}

export function csvParse(data: string): ImportEntry[] {
  const normalized = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const records = csvSplit(normalized)
  if (records.length < 1)
    return []

  const headerFields = records[0]
  let keyCol: ColumnDef | undefined
  let sourceCol: ColumnDef | undefined
  let tagsCol: ColumnDef | undefined
  let ctxCol: ColumnDef | undefined
  const langCols: ColumnDef[] = []

  for (let idx = 0; idx < headerFields.length; idx++) {
    const h = headerFields[idx].trim().toLowerCase()
    let role: 'key' | 'sourceText' | 'tags' | 'context' | 'lang' = 'lang'
    if (h === 'key')
      role = 'key'
    else if (h === 'sourcetext' || h === 'source_text')
      role = 'sourceText'
    else if (h === 'tags')
      role = 'tags'
    else if (h === 'context')
      role = 'context'
    const col: ColumnDef = { idx, role }
    if (col.role === 'lang')
      col.langCode = headerFields[idx].trim()
    if (col.role === 'key')
      keyCol = col
    else if (col.role === 'sourceText')
      sourceCol = col
    else if (col.role === 'tags')
      tagsCol = col
    else if (col.role === 'context')
      ctxCol = col
    else
      langCols.push(col)
  }

  if (!keyCol)
    return []

  sourceCol = sourceCol ?? keyCol
  const hasLang = langCols.length > 0
  const entries: ImportEntry[] = []
  for (let i = 1; i < records.length; i++) {
    const vals = records[i]
    const get = (idx: number): string => (vals[idx] ?? '').trim()
    const key = get(keyCol.idx)
    if (!key)
      continue

    const base = {
      key,
      sourceText: get(sourceCol.idx) || key,
      tags: tagsCol && vals[tagsCol.idx] ? vals[tagsCol.idx].split(';').map(t => t.trim()) : [],
      context: ctxCol ? get(ctxCol.idx) : '',
    }

    if (!hasLang) {
      entries.push({ ...base, translatedText: '' })
      continue
    }

    for (const c of langCols)
      entries.push({ ...base, translatedText: get(c.idx), lang: c.langCode! })
  }
  return entries
}
