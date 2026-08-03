import { ProjectRole, SystemRole } from '../constants/roles'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'

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

export async function createProject(userId: string, data: { name: string, description?: string, sourceLanguage?: string, code: string }) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } })
  if (existing)
    throw new AppError(1004, 'code already exists')
  return prisma.project.create({
    data: {
      userId,
      code: data.code,
      name: data.name,
      description: data.description || '',
      sourceLanguage: data.sourceLanguage || 'en',
    },
  })
}

export async function updateProject(projectSlug: string, data: { name?: string, description?: string, sourceLanguage?: string, code?: string }) {
  const p = await resolveProject(projectSlug)
  if (!p)
    throw new AppError(1003, 'project not found')
  if (data.code && data.code !== p.code) {
    const existing = await prisma.project.findUnique({ where: { code: data.code } })
    if (existing)
      // eslint-disable-next-line no-throw-literal
      throw { code: 1004, message: 'code already exists' }
  }
  return prisma.project.update({
    where: { id: p.id },
    data: {
      name: data.name,
      description: data.description,
      sourceLanguage: data.sourceLanguage || p.sourceLanguage,
      code: data.code,
    },
  })
}

export async function deleteProject(projectSlug: string) {
  const p = await resolveProject(projectSlug)
  if (!p)
    throw new AppError(1003, 'project not found')
  return prisma.project.delete({ where: { id: p.id } })
}
