import { prisma } from '../index'

export async function listProjects(userId: string, page: number, pageSize: number) {
  const memberProjectIds = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
  const ids = memberProjectIds.map(m => m.projectId)
  const where = { OR: [{ userId }, { id: { in: ids } }] }
  const [projects, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.project.count({ where }),
  ])
  return { projects, total }
}

async function resolveProject(identifier: string) {
  let p = await prisma.project.findUnique({ where: { id: identifier } })
  if (!p) p = await prisma.project.findUnique({ where: { code: identifier } })
  return p
}

export async function getProject(identifier: string) {
  const p = await resolveProject(identifier)
  if (!p) throw { code: 1003, message: 'project not found' }
  return p
}

export async function createProject(userId: string, data: { name: string; description?: string; sourceLanguage?: string; code: string }) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } })
    if (existing) throw { code: 1004, message: 'code already exists' }
  return prisma.project.create({
    data: {
      userId,
      code: data.code,
      name: data.name,
      description: data.description || '',
      sourceLanguage: data.sourceLanguage || 'en',
    }
  })
}

export async function updateProject(identifier: string, data: { name: string; description?: string; sourceLanguage?: string; code?: string }) {
  const p = await resolveProject(identifier)
  if (!p) throw { code: 1003, message: 'project not found' }
  if (data.code && data.code !== p.code) {
    const existing = await prisma.project.findUnique({ where: { code: data.code } })
  if (existing) throw { code: 1004, message: 'code already exists' }
  }
  return prisma.project.update({
    where: { id: p.id },
    data: {
      name: data.name,
      description: data.description,
      sourceLanguage: data.sourceLanguage || p.sourceLanguage,
      code: data.code,
    }
  })
}

export async function deleteProject(identifier: string) {
  const p = await resolveProject(identifier)
  if (!p) throw { code: 1003, message: 'project not found' }
  return prisma.project.delete({ where: { id: p.id } })
}
