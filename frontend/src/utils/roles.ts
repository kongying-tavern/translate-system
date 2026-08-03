export const SystemRole = {
  SuperAdmin: 'super_admin',
  Admin: 'admin',
  User: 'user',
} as const

export const ProjectRole = {
  Admin: 'admin',
  Maintainer: 'maintainer',
  Member: 'member',
} as const

/** 系统角色等级（与后端 constants/roles.ts ROLE_LEVEL 一致） */
export const SYS_ROLE_LEVEL: Record<string, number> = {
  [SystemRole.SuperAdmin]: 3,
  [SystemRole.Admin]: 2,
  [SystemRole.User]: 1,
}

/** 项目角色等级（与后端 constants/roles.ts PROJECT_ROLE_LEVEL 一致） */
export const PROJECT_ROLE_LEVEL: Record<string, number> = {
  [ProjectRole.Admin]: 3,
  [ProjectRole.Maintainer]: 2,
  [ProjectRole.Member]: 1,
}

export function roleLabel(r: string): string {
  const labels: Record<string, string> = {
    [SystemRole.SuperAdmin]: '超管',
    [SystemRole.Admin]: '管理员',
    [SystemRole.User]: '普通用户',
  }
  return labels[r] || r
}

export function projectRoleLabel(r: string | null): string {
  const labels: Record<string, string> = {
    [ProjectRole.Admin]: '管理员',
    [ProjectRole.Maintainer]: '维护者',
    [ProjectRole.Member]: '成员',
  }
  return r ? labels[r] || r : '-'
}
