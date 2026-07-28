import type { ImportEntry } from './types'

export function xmlParse(data: string): ImportEntry[] {
  const entries: ImportEntry[] = []
  const langRe = /<language\s+code="([^"]*)"[^>]*>([\s\S]*?)<\/language>/g
  let lm
  while (true) {
    lm = langRe.exec(data)
    if (!lm)
      break
    const langCode = lm[1]
    const strRe = /<string\s+name="([^"]*)"(?:\s+sourceText="([^"]*)")?(?:\s+tags="([^"]*)")?(?:\s+context="([^"]*)")?[^>]*>([\s\S]*?)<\/string>/g
    let sm
    while (true) {
      sm = strRe.exec(lm[2])
      if (!sm)
        break
      entries.push({ key: sm[1], sourceText: sm[2] || sm[1], translatedText: sm[5].trim(), tags: sm[3] ? sm[3].split(';').map((t: string) => t.trim()) : [], context: sm[4] || '', lang: langCode })
    }
  }
  if (!entries.length) {
    const re = /<string\s+name="([^"]*)"(?:\s+sourceText="([^"]*)")?(?:\s+tags="([^"]*)")?(?:\s+context="([^"]*)")?[^>]*>([\s\S]*?)<\/string>/g
    let m
    while (true) {
      m = re.exec(data)
      if (!m)
        break
      entries.push({ key: m[1], sourceText: m[2] || m[1], translatedText: m[5].trim(), tags: m[3] ? m[3].split(';').map((t: string) => t.trim()) : [], context: m[4] || '' })
    }
  }
  return entries
}
