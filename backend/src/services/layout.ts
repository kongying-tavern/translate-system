import { prisma } from '../index'

// Templates
export async function listTemplates(projectId: string) {
  return prisma.layoutTemplate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}
export async function getTemplate(id: string) {
  const t = await prisma.layoutTemplate.findUnique({ where: { id } })
  if (!t) throw { code: 1003, message: 'template not found' }
  return t
}
export async function createTemplate(projectId: string, data: any) {
  return prisma.layoutTemplate.create({ data: { projectId, ...data } })
}
export async function updateTemplate(id: string, data: any) {
  return prisma.layoutTemplate.update({ where: { id }, data })
}
export async function deleteTemplate(id: string) {
  return prisma.layoutTemplate.delete({ where: { id } })
}

// Configs
export async function listConfigs(projectId: string) {
  return prisma.layoutConfig.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}
export async function getConfig(id: string) {
  const c = await prisma.layoutConfig.findUnique({ where: { id } })
  if (!c) throw { code: 1003, message: 'config not found' }
  return c
}
export async function createConfig(projectId: string, data: any) {
  return prisma.layoutConfig.create({ data: { projectId, ...data, overrideConfig: data.overrideConfig || {} } })
}
export async function updateConfig(id: string, data: any) {
  return prisma.layoutConfig.update({ where: { id }, data })
}
export async function deleteConfig(id: string) {
  return prisma.layoutConfig.delete({ where: { id } })
}
export async function getResolvedConfig(id: string) {
  const c = await prisma.layoutConfig.findUnique({ where: { id } })
  if (!c) throw { code: 1003, message: 'config not found' }
  let result: any = {}
  if (c.templateId) {
    const t = await prisma.layoutTemplate.findUnique({ where: { id: c.templateId } })
    if (t) result = { ...(t.config as any) }
  }
  const override = c.overrideConfig as any
  return { ...result, ...override }
}
