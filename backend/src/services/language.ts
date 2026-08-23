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
  // 追加到末尾（max+100），避免默认 0 与既有语言并列导致刷新后按 languageCode 兜底排序
  const max = await prisma.projectLanguage.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  return prisma.projectLanguage.create({ data: { projectId, languageCode, sortOrder: (max._max.sortOrder ?? 0) + 100 } })
}

/** 确保语言已在项目语言中；不存在则自动添加（默认排序置于最前） */
export async function ensureProjectLanguage(projectId: string, languageCode: string) {
  const exists = await prisma.projectLanguage.findUnique({
    where: { projectId_languageCode: { projectId, languageCode } },
  })
  if (exists)
    return
  const min = await prisma.projectLanguage.aggregate({
    where: { projectId },
    _min: { sortOrder: true },
  })
  await prisma.projectLanguage.create({
    data: { projectId, languageCode, sortOrder: (min._min.sortOrder ?? 0) - 100 },
  })
}

export async function removeProjectLanguage(projectId: string, languageCode: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } })
  if (project?.sourceLanguage === languageCode)
    throw new AppError(ErrCode.InvalidParams, '源语言不可删除，请先更换项目源语言')
  return prisma.projectLanguage.deleteMany({ where: { projectId, languageCode } })
}

/** 按行 id 更新代码别名；projectId 用于校验行归属，防跨项目改写 */
export async function updateLanguageCodeAlias(projectId: string, id: string, codeAlias: string) {
  const row = await prisma.projectLanguage.findFirst({ where: { id, projectId } })
  if (!row)
    throw new AppError(ErrCode.NotFound, 'language not found')
  return prisma.projectLanguage.update({ where: { id }, data: { codeAlias: codeAlias || null } })
}

/** 按行 id 更新排序；projectId 用于校验行归属，防跨项目改写 */
export async function updateLanguageSortOrder(projectId: string, id: string, sortOrder: number) {
  const row = await prisma.projectLanguage.findFirst({ where: { id, projectId } })
  if (!row)
    throw new AppError(ErrCode.NotFound, 'language not found')
  return prisma.projectLanguage.update({ where: { id }, data: { sortOrder } })
}

export async function getLanguageDisplayMap(projectId: string): Promise<{ aliases: Record<string, string>, languageOrder: string[] }> {
  const langs = await prisma.projectLanguage.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { languageCode: 'asc' }] })
  const aliases: Record<string, string> = {}
  const languageOrder: string[] = []
  for (const l of langs) {
    aliases[l.languageCode] = l.codeAlias || l.languageCode
    languageOrder.push(l.languageCode)
  }
  return { aliases, languageOrder }
}
