import type { ImportEntry } from './types'
import { load } from 'js-yaml'
import { ErrCode } from '../../lib/errors'
import { AppError } from '../../utils/AppError'
import { parseStructured } from './utils'

/**
 * YAML 流式解析：js-yaml load 整体建对象树后交由 parseStructured 生成器逐条产出（不物化条目数组）。
 * 返回可重复迭代的 Iterable——每次迭代从同一棵树重建新生成器，供「校验遍历 → 写入遍历」两轮消费。
 */
export function yamlParse(data: string): Iterable<ImportEntry> {
  const parsed = load(data) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new AppError(ErrCode.InvalidParams, 'YAML 数据必须是键值映射对象（key: value），不支持列表或标量')
  const tree = parsed as Record<string, unknown>
  return {
    [Symbol.iterator]: () => parseStructured(tree),
  }
}
