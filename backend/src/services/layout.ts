import type { Prisma } from '@prisma/client'
import { prisma } from '../index'
import { AppError } from '../utils/AppError'

// Templates
export async function listTemplates(projectId: string) {
  return prisma.layoutTemplate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
}
export async function getTemplate(id: string) {
  const t = await prisma.layoutTemplate.findUnique({ where: { id } })
  if (!t)
    throw new AppError(1003, 'template not found')
  return t
}
export async function createTemplate(projectId: string, data: Omit<Prisma.LayoutTemplateUncheckedCreateInput, 'id' | 'projectId'>) {
  return prisma.layoutTemplate.create({ data: { projectId, ...data } })
}
export async function updateTemplate(id: string, data: Prisma.LayoutTemplateUncheckedUpdateInput) {
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
  if (!c)
    throw new AppError(1003, 'config not found')
  return c
}
export async function createConfig(projectId: string, data: Omit<Prisma.LayoutConfigUncheckedCreateInput, 'id' | 'projectId'>) {
  return prisma.layoutConfig.create({ data: { projectId, ...data, overrideConfig: data.overrideConfig || {} } })
}
export async function updateConfig(id: string, data: Prisma.LayoutConfigUncheckedUpdateInput) {
  return prisma.layoutConfig.update({ where: { id }, data })
}
export async function deleteConfig(id: string) {
  return prisma.layoutConfig.delete({ where: { id } })
}
export async function getResolvedConfig(id: string) {
  const c = await prisma.layoutConfig.findUnique({ where: { id } })
  if (!c)
    throw new AppError(1003, 'config not found')
  let result: Record<string, unknown> = {}
  if (c.templateId) {
    const t = await prisma.layoutTemplate.findUnique({ where: { id: c.templateId } })
    if (t)
      result = { ...(t.config as Record<string, unknown>) }
  }
  const override = c.overrideConfig as Record<string, unknown>
  return { ...result, ...override }
}
