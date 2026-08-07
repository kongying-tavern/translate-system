import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ProjectRole, SystemRole } from '@/utils/roles'

export function useProjectPermission() {
  const auth = useAuthStore()

  const isSuperAdmin = computed(() => auth.role === SystemRole.SuperAdmin)
  const isSysAdminOrAbove = computed(() => auth.role === SystemRole.SuperAdmin || auth.role === SystemRole.Admin)

  const projectRole = computed(() => auth.projectRole)
  const isProjectAdmin = computed(() => projectRole.value === ProjectRole.Admin)
  const isProjectMaintainer = computed(() => projectRole.value === ProjectRole.Maintainer)

  const isProjectAdminOrAbove = computed(() => isSuperAdmin.value || isProjectAdmin.value)
  const canManageContent = computed(() => isSuperAdmin.value || isProjectAdmin.value || isProjectMaintainer.value)

  // Menu permissions
  const canSeeUserManagement = isSysAdminOrAbove
  const canSeeMemberManagement = computed(() => isProjectAdminOrAbove.value)
  const canSeeLanguageManagement = canManageContent
  const canSeeImportManagement = canManageContent
  const canSeeExportManagement = computed(() => true)

  // Function permissions
  const canEditProject = isSuperAdmin
  const canDeleteProject = isSuperAdmin
  const canCreateProject = isSuperAdmin
  const canManageKeys = canManageContent
  const canEditKeyColumn = canManageContent
  const canEditSourceColumn = canManageContent
  const canEditTagsColumn = canManageContent
  const canEditContextColumn = canManageContent
  const canReorderRows = canManageContent
  const canManageProject = isProjectAdminOrAbove
  const canManageExportTemplates = canManageContent

  return {
    isSuperAdmin,
    isSysAdminOrAbove,
    projectRole,
    isProjectAdmin,
    isProjectMaintainer,
    isProjectAdminOrAbove,
    canManageContent,
    canManageProject,
    canSeeUserManagement,
    canSeeMemberManagement,
    canSeeLanguageManagement,
    canSeeImportManagement,
    canSeeExportManagement,
    canEditProject,
    canDeleteProject,
    canCreateProject,
    canManageKeys,
    canEditKeyColumn,
    canEditSourceColumn,
    canEditTagsColumn,
    canEditContextColumn,
    canReorderRows,
    canManageExportTemplates,
  }
}
