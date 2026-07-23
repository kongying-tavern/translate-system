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

export async function getProject(id: string) {
  const p = await prisma.project.findUnique({ where: { id } })
  if (!p) throw { code: 1003, message: 'project not found' }
  return p
}

export async function createProject(userId: string, data: { name: string; description?: string; sourceLanguage?: string }) {
  return prisma.project.create({
    data: {
      userId,
      name: data.name,
      description: data.description || '',
      sourceLanguage: data.sourceLanguage || 'en',
    }
  })
}

export async function updateProject(id: string, data: { name: string; description?: string; sourceLanguage?: string }) {
  const p = await prisma.project.findUnique({ where: { id } })
  if (!p) throw { code: 1003, message: 'project not found' }
  return prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      sourceLanguage: data.sourceLanguage || p.sourceLanguage,
    }
  })
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } })
}
