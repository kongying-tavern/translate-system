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

/**
 * 逐行产出 CSV 记录（流式，不物化全量二维数组）。
 * 支持 "" 转义、引号内逗号/换行；CRLF/LF/CR 均视为换行。末行无换行也产出。
 */
function* csvRows(data: string): Generator<string[]> {
  let fields: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const n = data.length
  while (i < n) {
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
      else if (ch === '\r') {
        // 引号内换行统一为 \n（对齐原实现 normalize 语义）
        field += '\n'
        if (data[i + 1] === '\n')
          i++
      }
      else {
        field += ch
      }
      i++
      continue
    }
    if (ch === '"') {
      quoted = true
      i++
      continue
    }
    if (ch === ',') {
      fields.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\n') {
      fields.push(field)
      field = ''
      const rec = fields
      fields = []
      if (rec.some(f => f.trim()))
        yield rec
      i++
      continue
    }
    if (ch === '\r') {
      fields.push(field)
      field = ''
      const rec = fields
      fields = []
      if (rec.some(f => f.trim()))
        yield rec
      if (data[i + 1] === '\n')
        i++
      i++
      continue
    }
    field += ch
    i++
  }
  fields.push(field)
  if (fields.some(f => f.trim()))
    yield fields
}

function* csvParseGen(data: string): Generator<ImportEntry> {
  const rows = csvRows(data)
  const first = rows.next()
  if (first.done)
    throw new AppError(ErrCode.InvalidParams, 'CSV 需要表头行与至少一行数据，请检查内容')

  const headerFields = first.value
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

  for (const vals of rows) {
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
      yield { ...base, translatedText: '' }
      continue
    }

    for (const c of langCols)
      yield { ...base, translatedText: get(c.idx), lang: c.langCode! }
  }
}

/**
 * CSV 流式解析（不物化全量数组，逐行产出）。
 * 返回可重复迭代的 Iterable——每次迭代从 raw 重建新生成器，
 * 供「校验遍历 → 写入遍历」两轮消费；校验抛错即全量拒绝。
 */
export function csvParse(data: string): Iterable<ImportEntry> {
  return {
    [Symbol.iterator]: () => csvParseGen(data),
  }
}
