import { ProjectRole, SystemRole } from '../constants/roles'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'
import { ensureProjectLanguage } from './language'

export async function listProjects(userId: string, userRole: string, page: number, pageSize: number) {
  const memberProjectIds = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
  const ids = memberProjectIds.map(m => m.projectId)
  const where = { OR: [{ userId }, { id: { in: ids } }] }
  const [projects, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.project.count({ where }),
  ])
  return { rows: await attachProjectRole(userId, userRole, projects), total }
}

/** 为项目列表附加当前用户在每个项目的角色（与 assertProjectAccess 保持一致） */
async function attachProjectRole(userId: string, userRole: string, projects: Array<{ id: string, userId: string } & Record<string, unknown>>) {
  const members = await prisma.projectMember.findMany({
    where: { userId, projectId: { in: projects.map(p => p.id) } },
    select: { projectId: true, projectRole: true },
  })
  const roleByProject: Record<string, string> = {}
  for (const m of members)
    roleByProject[m.projectId] = m.projectRole
  return projects.map(p => ({
    ...p,
    projectRole: userRole === SystemRole.SuperAdmin || p.userId === userId
      ? ProjectRole.Admin
      : (roleByProject[p.id] ?? null),
  }))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function resolveProject(projectSlug: string) {
  let p = UUID_RE.test(projectSlug) ? await prisma.project.findUnique({ where: { id: projectSlug } }) : null
  if (!p)
    p = await prisma.project.findUnique({ where: { code: projectSlug } })
  return p
}

export async function getProject(projectSlug: string) {
  const p = await resolveProject(projectSlug)
  if (!p)
    throw new AppError(1003, 'project not found')
  return p
}

export async function createProject(userId: string, data: { name: string, description?: string, sourceLanguage: string, code: string }) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } })
  if (existing)
    throw new AppError(1004, 'code already exists')
  const sourceLanguage = data.sourceLanguage
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        userId,
        code: data.code,
        name: data.name,
        description: data.description || '',
        sourceLanguage,
      },
    })
    await tx.projectLanguage.create({
      data: { projectId: project.id, languageCode: sourceLanguage, sortOrder: 0 },
    })
    return project
  })
}

export async function updateProject(projectSlug: string, data: { name?: string, description?: string, sourceLanguage?: string, code?: string }) {
  const p = await resolveProject(projectSlug)
  if (!p)
    throw new AppError(1003, 'project not found')
  if (data.code && data.code !== p.code) {
    const existing = await prisma.project.findUnique({ where: { code: data.code } })
    if (existing)
      throw new AppError(1004, 'code already exists')
  }
  // 源语言必填语义：无论本次是否变更源语言，保存前无条件确保最终源语言存在对应语言条目
  // （缺失即自动补建并置顶）——顺带自愈存量「有源语言设置但语言管理缺该条目」的脏数据
  const sourceLanguage = data.sourceLanguage || p.sourceLanguage
  await ensureProjectLanguage(p.id, sourceLanguage)
  return prisma.project.update({
    where: { id: p.id },
    data: {
      name: data.name,
      description: data.description,
      sourceLanguage,
      code: data.code,
    },
  })
}

export async function setProjectSourceLanguage(projectId: string, languageCode: string) {
  await ensureProjectLanguage(projectId, languageCode)
  return prisma.project.update({
    where: { id: projectId },
    data: { sourceLanguage: languageCode },
  })
}

export async function deleteProject(projectSlug: string) {
  const p = await resolveProject(projectSlug)
  if (!p)
    throw new AppError(1003, 'project not found')
  return prisma.project.delete({ where: { id: p.id } })
}
