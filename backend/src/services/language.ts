import { BASE_LANGUAGES } from '../data/languages'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'

export function getBaseLanguages() {
  return BASE_LANGUAGES
}

export function searchBaseLanguages(q: string) {
  const needle = q.toLowerCase()
  return BASE_LANGUAGES
    .filter(l => l.languageCode.toLowerCase().includes(needle) || l.englishName.toLowerCase().includes(needle) || l.nativeName.toLowerCase().includes(needle))
    .slice(0, 50)
}

export async function listProjectLanguages(projectId: string) {
  return prisma.projectLanguage.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { languageCode: 'asc' }] })
}

export async function addProjectLanguage(projectId: string, languageCode: string) {
  if (!BASE_LANGUAGES.some(l => l.languageCode === languageCode))
    throw new AppError(ErrCode.InvalidParams, `unsupported language code: ${languageCode}`)
  const exists = await prisma.projectLanguage.findUnique({ where: { projectId_languageCode: { projectId, languageCode } } })
  if (exists)
    throw new AppError(1004, 'language already added to project')
  return prisma.projectLanguage.create({ data: { projectId, languageCode } })
}

export async function removeProjectLanguage(projectId: string, languageCode: string) {
  return prisma.projectLanguage.deleteMany({ where: { projectId, languageCode } })
}

export async function updateLanguageAlias(id: string, alias: string) {
  return prisma.projectLanguage.update({ where: { id }, data: { alias: alias || null } })
}

export async function updateLanguageSortOrder(id: string, sortOrder: number) {
  return prisma.projectLanguage.update({ where: { id }, data: { sortOrder } })
}

export async function getLanguageDisplayMap(projectId: string): Promise<{ aliases: Record<string, string>, languageOrder: string[] }> {
  const langs = await prisma.projectLanguage.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { languageCode: 'asc' }] })
  const aliases: Record<string, string> = {}
  const languageOrder: string[] = []
  for (const l of langs) {
    aliases[l.languageCode] = l.alias || l.languageCode
    languageOrder.push(l.languageCode)
  }
  return { aliases, languageOrder }
}
