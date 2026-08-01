import { PROJECT_ROLE_LEVEL, ProjectRole, ROLE_LEVEL, SystemRole } from '../constants/roles'
import { AppError } from '../utils/AppError'
import { ErrCode } from './errors'
import { prisma } from './prisma'

async function resolveProject(identifier: string) {
  let p = null
  try {
    p = await prisma.project.findUnique({ where: { id: identifier } })
  }
  catch {}
  if (!p)
    p = await prisma.project.findUnique({ where: { code: identifier } })
  return p
}

export interface ProjectAccess {
  projectId: string
  projectRole: string
}

/**
 * 检查用户对项目的访问权限，返回解析后的项目 ID 与项目角色。
 * super_admin 或 owner 直接放行；其余成员按项目角色校验 minProjectRole。
 */
export async function assertProjectAccess(
  userId: string,
  userRole: string,
  identifier: string,
  minProjectRole?: string,
): Promise<ProjectAccess> {
  const project = await resolveProject(identifier)
  if (!project)
    throw new AppError(ErrCode.NotFound, 'project not found')

  if (userRole === SystemRole.SuperAdmin)
    return { projectId: project.id, projectRole: ProjectRole.Admin }

  if (project.userId === userId)
    return { projectId: project.id, projectRole: ProjectRole.Admin }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
  })
  if (!member)
    throw new AppError(ErrCode.Forbidden, '无项目权限')

  if (minProjectRole) {
    const level = PROJECT_ROLE_LEVEL[member.projectRole] || 0
    if (level < (PROJECT_ROLE_LEVEL[minProjectRole] || 0))
      throw new AppError(ErrCode.Forbidden, '项目权限不足')
  }

  return { projectId: project.id, projectRole: member.projectRole }
}

/** 校验系统角色等级，不足则抛 Forbidden */
export function assertSystemRole(userRole: string, minRole: string) {
  if ((ROLE_LEVEL[userRole] || 0) < (ROLE_LEVEL[minRole] || 0))
    throw new AppError(ErrCode.Forbidden, '没有权限')
}
