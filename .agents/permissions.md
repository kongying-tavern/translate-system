# 角色权限（核心矩阵）

> 本篇是角色/权限核心矩阵速查。

> 完整的三维权限模型（作用层级 / 实现方案 / 接口层面）与维护指引见 [`docs/permission-guide.md`](../docs/permission-guide.md)，本篇是速查矩阵。

系统角色与项目角色分离。

## 系统角色（users.role）

| 角色 | 新建/编辑项目 | 用户管理 | 说明 |
|------|:--:|:--:|------|
| super_admin | ✅ | ✅ | 首位注册用户自动成为超管 |
| admin | ❌ | ✅ | 可管理用户，但不能管理 super_admin，只能创建 user 角色、不能提升他人角色到高于自己 |
| user | ❌ | ❌ | 默认角色（普通用户） |

权限常量：ROLE_LEVEL = { super_admin:3, admin:2, user:1 }

## 项目角色（project_members.project_role）

| 角色 | 等级 | 项目成员 | 语言管理 | 导入 | Key 管理 | 翻译 | 导出模板 |
|------|:---:|:--:|:--:|:--:|:--:|:--:|:--:|
| admin | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| maintainer | 2 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| member | 1 | ❌ | ❌ | ❌ | ❌ | 仅编辑译文 | 仅使用模板 |

项目 owner 自动拥有项目 admin 权限。系统 super_admin 对所有项目拥有全部权限。

## 三层权限模型

**1. 菜单权限**（sidebar 可见性）：

| 菜单 | 系统角色 | 项目角色 |
|------|:-------:|:--------:|
| 用户管理 | SuperAdmin/Admin | — |
| 项目管理 | Any | — |
| 翻译管理 | Any | Any |
| 项目成员 | Any | Admin |
| 语言管理 | Any | Admin/Maintainer |
| 导入管理 | Any | Admin/Maintainer |
| 导出模板 | Any | Any |

**2. 功能权限**（按钮/操作）：

| 页面 | 操作 | 系统角色 | 项目角色 |
|------|------|:-------:|:--------:|
| 项目管理 | 编辑项目 | SuperAdmin | — |
| 翻译管理 | 新增/删除Key | — | Admin/Maintainer |
| 翻译管理 | 编辑Key/原文/标签/备注列 | — | Admin/Maintainer |
| 翻译管理 | 排序行 | — | Admin/Maintainer |
| 导出模板 | 新增/删除/编辑模板 | — | Admin/Maintainer |

**3. 数据权限**：项目选择器 Project-Any（只能看到自己有成员/owner 身份的项目）。

## 工具与拦截链

- **前端权限工具**：统一使用 hooks/useProjectPermission.ts 的 useProjectPermission() 取权限 computed
- 可用项如 canManageContent / canManageProject；不要在页面里直接判 auth.role
- **后端权限链**：
  - @Security('auth'/'admin') → expressAuthentication 解析 JWT / API Key，回写 req.userId / req.userRole
  - 控制器内 assertProjectAccess(...)：super_admin / owner 直接放行为 admin；成员按 minProjectRole 比较等级
  - assertSystemRole(role, minRole) 用于系统级门槛（用户管理、项目增删）
- **路由拦截**：meta.perm 声明门槛（sys:admin / sys:super_admin / proj:admin / proj:maintainer / proj:member），不通过重定向 `/`
- 双保险：路径含 :projectSlug 的页面，非成员且非 super_admin 一律拒绝——即使漏设 perm
