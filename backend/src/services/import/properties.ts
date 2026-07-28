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

export function propertiesParse(data: string): ImportEntry[] {
  const entries: ImportEntry[] = []
  const lines = data.split(/\r?\n/)
  let continued = ''
  for (let raw of lines) {
    if (continued) {
      raw = continued + raw.trimStart()
      continued = ''
    }
    if (isContinuation(raw)) {
      continued = raw.slice(0, -1)
      continue
    }
    const t = raw.trim()
    if (!t || t.startsWith('#') || t.startsWith('!'))
      continue
    const sep = findSeparator(t)
    if (sep === -1)
      continue
    const key = unescape(t.slice(0, sep).trimEnd())
    const value = unescape(t.slice(sep + 1).trimStart())
    entries.push({ key, sourceText: key, translatedText: value, tags: [], context: '' })
  }
  if (continued) {
    const t = continued.trim()
    if (t && !t.startsWith('#') && !t.startsWith('!')) {
      const sep = findSeparator(t)
      if (sep !== -1) {
        const key = unescape(t.slice(0, sep).trimEnd())
        const value = unescape(t.slice(sep + 1).trimStart())
        entries.push({ key, sourceText: key, translatedText: value, tags: [], context: '' })
      }
    }
  }
  return entries
}
