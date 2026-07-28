export const SystemRole = {
  SuperAdmin: 'super_admin',
  Admin: 'admin',
  User: 'user',
} as const

export const ROLE_LEVEL: Record<string, number> = {
  [SystemRole.SuperAdmin]: 3,
  [SystemRole.Admin]: 2,
  [SystemRole.User]: 1,
}

export const ProjectRole = {
  Admin: 'admin',
  Maintainer: 'maintainer',
  Member: 'member',
} as const

export const PROJECT_ROLE_LEVEL: Record<string, number> = {
  [ProjectRole.Admin]: 3,
  [ProjectRole.Maintainer]: 2,
  [ProjectRole.Member]: 1,
}
