import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'

export async function getBaseLanguages() {
  return prisma.baseLanguage.findMany({ orderBy: { englishName: 'asc' } })
}

export async function searchBaseLanguages(q: string) {
  return prisma.baseLanguage.findMany({
    where: { OR: [{ languageCode: { contains: q, mode: 'insensitive' } }, { englishName: { contains: q, mode: 'insensitive' } }, { nativeName: { contains: q, mode: 'insensitive' } }] },
    take: 50,
    orderBy: { englishName: 'asc' },
  })
}

export async function listProjectLanguages(projectId: string) {
  return prisma.projectLanguage.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { languageCode: 'asc' }] })
}

export async function addProjectLanguage(projectId: string, languageCode: string) {
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
