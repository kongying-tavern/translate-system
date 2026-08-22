import type { ImportEntry } from './types'

function unescape(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(.)/g, (_, c) => {
      switch (c) {
        case 'n': return '\n'
        case 'r': return '\r'
        case 't': return '\t'
        default: return c
      }
    })
}

function isContinuation(s: string): boolean {
  let n = 0
  for (let i = s.length - 1; i >= 0 && s[i] === '\\'; i--)
    n++
  return n % 2 === 1
}

function findSeparator(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      i++
      continue
    }
    if (s[i] === '=' || s[i] === ':')
      return i
  }
  return -1
}

/** 单行记录 → entry；无分隔符返回 null（跳过该行） */
function toEntry(t: string): ImportEntry | null {
  const sep = findSeparator(t)
  if (sep === -1)
    return null
  const key = unescape(t.slice(0, sep).trimEnd())
  return { key, sourceText: key, translatedText: unescape(t.slice(sep + 1).trimStart()), tags: [], context: '' }
}

function* propertiesParseGen(data: string): Generator<ImportEntry> {
  let continued = ''
  let pos = 0
  while (pos < data.length) {
    let line: string
    const nl = data.indexOf('\n', pos)
    if (nl === -1) {
      line = data.slice(pos)
      pos = data.length
    }
    else {
      line = data.slice(pos, nl)
      pos = nl + 1
    }
    if (line.endsWith('\r'))
      line = line.slice(0, -1)
    if (continued) {
      line = continued + line.trimStart()
      continued = ''
    }
    if (isContinuation(line)) {
      continued = line.slice(0, -1)
      continue
    }
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('!'))
      continue
    const entry = toEntry(t)
    if (entry)
      yield entry
  }
  if (continued) {
    const t = continued.trim()
    if (t && !t.startsWith('#') && !t.startsWith('!')) {
      const entry = toEntry(t)
      if (entry)
        yield entry
    }
  }
}

/**
 * Properties 流式解析（逐行状态机直接产出，无全量行数组/条目数组）：
 * 支持 =/: 分隔、# / ! 注释、反斜杠续行、\uXXXX 与 \n\r\t 转义。
 * 返回可重复迭代的 Iterable——每次迭代从 raw 重建新生成器，
 * 供「校验遍历 → 写入遍历」两轮消费；校验抛错即全量拒绝。
 */
export function propertiesParse(data: string): Iterable<ImportEntry> {
  return {
    [Symbol.iterator]: () => propertiesParseGen(data),
  }
}
