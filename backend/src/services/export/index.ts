import type { Prisma } from '@prisma/client'
import type { ExportKey, FlatTranslation } from './types'
import { prisma } from '../../index'
import { AppError } from '../../utils/AppError'
import { exportCSV } from './csv'
import { exportFlatJSON, exportNestedJSON } from './json'
import { exportProperties } from './properties'
import { exportFlatXML, exportNestedXML } from './xml'
import { exportFlatYAML, exportNestedYAML } from './yaml'

export async function listTemplates(projectId: string) {
  return prisma.exportTemplate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}

export async function resolveTemplate(templateSlug: string, projectSlug?: string) {
  let t = null
  try {
    t = await prisma.exportTemplate.findUnique({ where: { id: templateSlug } })
  }
  catch {}
  if (!t && projectSlug)
    t = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId: projectSlug, code: templateSlug } } })
  return t
}

export async function getTemplate(templateSlug: string, projectSlug?: string) {
  const t = await resolveTemplate(templateSlug, projectSlug)
  if (!t)
    throw new AppError(1003, 'template not found')
  return t
}

export async function createTemplate(projectId: string, data: Omit<Prisma.ExportTemplateUncheckedCreateInput, 'id' | 'projectId'>) {
  if (!data.code)
    throw new AppError(1001, 'code is required')
  const existing = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId, code: data.code } } })
  if (existing)
    throw new AppError(1004, 'code already exists')
  return prisma.exportTemplate.create({ data: { projectId, ...data, config: data.config || {} } })
}

export async function updateTemplate(id: string, data: Prisma.ExportTemplateUncheckedUpdateInput) {
  const code = typeof data.code === 'string' ? data.code : undefined
  if (code) {
    const t = await prisma.exportTemplate.findUnique({ where: { id } })
    if (t && code !== t.code) {
      const existing = await prisma.exportTemplate.findUnique({ where: { projectId_code: { projectId: t.projectId, code } } })
      if (existing)
        // eslint-disable-next-line no-throw-literal
        throw { code: 1004, message: 'code already exists' }
    }
  }
  return prisma.exportTemplate.update({ where: { id }, data })
}

export async function deleteTemplate(id: string) {
  return prisma.exportTemplate.delete({ where: { id } })
}

function flattenKeys(keys: ExportKey[], languageCodes: string[], aliases?: Record<string, string>) {
  const result: FlatTranslation[] = []
  for (const k of keys) {
    for (const lang of languageCodes) {
      const v = k.values.find(v => v.languageCode === lang)
      result.push({ translationKey: k.key, languageCode: lang, sourceText: k.sourceText, translatedText: v?.translatedText || '', alias: aliases?.[lang] })
    }
  }
  return result
}

export function exportTranslations(keys: ExportKey[], languageCodes: string[], formatType: string, aliases?: Record<string, string>, config?: Record<string, unknown>, filterTags?: string[]): [string, string] | [string, string, string] {
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
    case 'flat-json': return [exportFlatJSON(translations, languageCodes, config), 'json']
    case 'nested-json': return [exportNestedJSON(translations, languageCodes, config), 'json']
    case 'flat-yaml': return [exportFlatYAML(translations, languageCodes, config), 'yaml']
    case 'nested-yaml': return [exportNestedYAML(translations, languageCodes, config), 'yaml']
    case 'properties': return [exportProperties(translations, languageCodes, config), 'properties']
    case 'flat-xml': return [exportFlatXML(translations, languageCodes, config), 'xml']
    case 'nested-xml': return [exportNestedXML(translations, languageCodes, config), 'xml']
    case 'csv': return [exportCSV(translations, languageCodes, config), 'csv']
    default: return [exportFlatJSON(translations, languageCodes, config), 'json']
  }
}
