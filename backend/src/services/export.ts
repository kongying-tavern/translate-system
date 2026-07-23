import { prisma } from '../index'

export async function listTemplates(projectId: string) {
  return prisma.exportTemplate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}
export async function getTemplate(id: string) {
  const t = await prisma.exportTemplate.findUnique({ where: { id } })
  if (!t) throw { code: 1003, message: 'template not found' }
  return t
}
export async function createTemplate(projectId: string, data: any) {
  return prisma.exportTemplate.create({ data: { projectId, ...data, config: data.config || {} } })
}
export async function updateTemplate(id: string, data: any) {
  return prisma.exportTemplate.update({ where: { id }, data })
}
export async function deleteTemplate(id: string) {
  return prisma.exportTemplate.delete({ where: { id } })
}

function flattenKeys(keys: any[], languageCodes: string[], aliases?: Record<string, string>) {
  const result: any[] = []
  for (const k of keys) {
    for (const lang of languageCodes) {
      const v = k.values.find((v: any) => v.languageCode === lang)
      result.push({ translationKey: k.key, languageCode: lang, sourceText: k.sourceText, translatedText: v?.translatedText || '', alias: aliases?.[lang] })
    }
  }
  return result
}

export function exportTranslations(keys: any[], languageCodes: string[], formatType: string, aliases?: Record<string, string>, config?: any, filterTags?: string[]) {
  if (filterTags?.length) {
    keys = keys.filter(k => filterTags.some(t => k.tags?.includes(t)))
  }
  let translations = flattenKeys(keys, languageCodes, aliases)
  if (config?.skipIdentical) {
    translations = translations.filter(t => t.translatedText !== t.translationKey)
  }
  if (config?.skipEmpty) {
    translations = translations.filter(t => t.translatedText)
  }
  switch (formatType) {
    case 'json': return [exportJSON(translations, languageCodes, config), 'json']
    case 'flat-json': return [exportFlatJSON(translations, languageCodes, config), 'json']
    case 'csv': return [exportCSV(translations, languageCodes, config), 'csv']
    case 'properties': return [exportProperties(translations, languageCodes, config), 'properties']
    case 'xml': return [exportXML(translations, languageCodes, config), 'xml']
    default: return [exportFlatJSON(translations, languageCodes, config), 'json']
  }
}

function getLangKey(t: any, config?: any) { return config?.useCodeKey ? t.languageCode : (t.alias || t.languageCode) }

function exportFlatJSON(translations: any[], langs: string[], config?: any) {
  const result: Record<string, any> = {}
  for (const lang of langs) { const items: Record<string, string> = {}; for (const t of translations) { if (t.languageCode === lang) items[t.translationKey] = t.translatedText }; const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config); if (langs.length === 1) return JSON.stringify(items, null, 2); result[name] = items }
  return JSON.stringify(result, null, 2)
}

function exportJSON(translations: any[], langs: string[], config?: any) {
  const result: any = {}; for (const lang of langs) { const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config); result[name] = {}; for (const t of translations) { if (t.languageCode === lang) result[name][t.translationKey] = t.translatedText } }
  return JSON.stringify(result, null, 2)
}

function exportCSV(translations: any[], langs: string[], config?: any) {
  const rows: Record<string, any> = {}; for (const t of translations) { if (!rows[t.translationKey]) rows[t.translationKey] = { source: t.sourceText, langs: {} }; rows[t.translationKey].langs[t.languageCode] = t.translatedText }
  const headerNames = langs.map(l => getLangKey(translations.find(t => t.languageCode === l) || { languageCode: l }, config))
  const header = ['key', 'source', ...headerNames].join(','); const lines = [header]
  for (const [key, row] of Object.entries(rows)) { lines.push([csvEscape(key), csvEscape((row as any).source), ...langs.map(l => csvEscape((row as any).langs[l] || ''))].join(',')) }
  return lines.join('\n')
}

function exportProperties(translations: any[], langs: string[], config?: any) {
  const result: any = {}; for (const lang of langs) { const lines: string[] = []; for (const t of translations) { if (t.languageCode === lang) lines.push(t.translationKey + '=' + t.translatedText) }; const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config); result[name] = lines.join('\n') }
  return JSON.stringify(result, null, 2)
}

function exportXML(translations: any[], langs: string[], config?: any) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<resources>\n'; for (const lang of langs) { const name = getLangKey(translations.find(t => t.languageCode === lang) || { languageCode: lang }, config); xml += '  <language code="' + xmlEscape(name) + '">\n'; for (const t of translations) { if (t.languageCode === lang) xml += '    <string name="' + xmlEscape(t.translationKey) + '">' + xmlEscape(t.translatedText) + '</string>\n' }; xml += '  </language>\n' }
  xml += '</resources>\n'; return xml
}

function csvEscape(s: string) { if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'; return s }
function xmlEscape(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
