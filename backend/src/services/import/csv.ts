import type { ImportEntry } from './types'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'

interface ColumnDef {
  idx: number
  role: 'key' | 'sourceText' | 'tags' | 'context' | 'lang'
  langCode?: string
}

/** CSV 表头严格匹配（大小写与写法完全一致、不支持别名）；未识别的列一律按语言代码处理 */
function matchRole(h: string): ColumnDef['role'] | undefined {
  switch (h) {
    case 'key':
      return 'key'
    case 'sourceText':
      return 'sourceText'
    case 'tags':
      return 'tags'
    case 'context':
      return 'context'
    default:
      return undefined
  }
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
  if (records.length < 2)
    throw new AppError(ErrCode.InvalidParams, 'CSV 需要表头行与至少一行数据，请检查内容')

  const headerFields = records[0]
  let keyCol: ColumnDef | undefined
  let sourceCol: ColumnDef | undefined
  let tagsCol: ColumnDef | undefined
  let ctxCol: ColumnDef | undefined
  const langCols: ColumnDef[] = []

  for (let idx = 0; idx < headerFields.length; idx++) {
    const role = matchRole(headerFields[idx].trim())
    const col: ColumnDef = { idx, role: role ?? 'lang' }
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
    throw new AppError(ErrCode.InvalidParams, 'CSV 未找到翻译键列（表头需为 key），请检查第一行表头')

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
