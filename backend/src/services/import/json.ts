import type { ImportEntry } from './types'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'
import { parseStructured } from './utils'

export function JSONParse(raw: string): ImportEntry[] {
  const data = JSON.parse(raw) as unknown
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new AppError(ErrCode.InvalidParams, 'JSON 数据必须是键值映射对象（{ key: value }），不支持数组或标量')
  return parseStructured(data as Record<string, unknown>)
}
