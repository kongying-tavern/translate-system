import type { ImportEntry } from './types'
import { load } from 'js-yaml'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'
import { parseStructured } from './utils'

export function yamlParse(data: string): ImportEntry[] {
  const parsed = load(data) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new AppError(ErrCode.InvalidParams, 'YAML 数据必须是键值映射对象（key: value），不支持列表或标量')
  return parseStructured(parsed as Record<string, unknown>)
}
