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
