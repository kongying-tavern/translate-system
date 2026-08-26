# 权限体系说明

本平台权限从三个维度正交设计：**作用层级**、**实现方案**、**接口层面**。理解这三个维度即可定位任何一项功能/接口的权限。

## 1. 权限总览（三维模型）

```
维度一（作用层级）         维度二（实现方案）          维度三（接口层面）
系统权限                 ├─ 菜单权限（sidebar 可见性）   ├─ 接口级系统权限（@Security / assertSystemRole）
项目权限                 ├─ 功能权限（按钮/操作可用性）  └─ 接口内项目权限（assertProjectAccess minProjectRole）
                        └─ 数据权限（可见数据范围）
```

- **作用层级**回答「控制什么」：系统权限控制平台级功能（用户管理、项目增删改），项目权限控制单个项目内的功能（翻译、语言、成员、导入、导出）。
- **实现方案**回答「在哪体现」：菜单是否显示、按钮是否可点、数据是否可见。
- **接口层面**回答「后端怎么拦」：路由级别的最小系统角色门槛 + 处理函数内对具体项目的角色约束。

三个维度不是互相替代，而是**叠加生效**：前端菜单/按钮隐藏是体验层，后端接口校验才是真正安全边界。所有敏感操作最终以后端校验为准。

---

## 2. 维度一：作用层级（系统权限 vs 项目权限）

系统角色与项目角色**正交独立**，互不包含。

### 2.1 系统角色（`users.role`，平台级）

| 角色 | 等级 | 新建/编辑/删除项目 | 用户管理 | 项目内加成 |
|------|:---:|:--:|:--:|:--:|
| `super_admin` | 3 | ✅ | ✅ | 对所有项目拥有全部权限（恒等于项目 admin） |
| `admin` | 2 | ❌ | ✅（有限制，见下） | 无 |
| `user` | 1 | ❌ | ❌ | 无 |

**admin 用户管理的限制**（`services/auth.ts` `canManage`）：
- 可管理除 `super_admin` 之外的所有用户；
- 只能创建 `user` 角色；
- 不能把他人角色提升到高于自己（admin 最高只能授予到 user）。

### 2.2 项目角色（`project_members.project_role`，项目内）

| 角色 | 等级 | 项目成员 | 语言管理 | 导入 | Key 管理 | 翻译 | 导出模板 |
|------|:---:|:--:|:--:|:--:|:--:|:--:|:--:|
| `admin` | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `maintainer` | 2 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `member` | 1 | ❌ | ❌ | ❌ | ❌ | 仅编辑译文 | 仅使用模板 |

- 项目 **owner**（`projects.userId`）自动拥有项目 `admin` 权限。
- 系统 **super_admin** 对所有项目恒拥有全部权限（后端直接放行）。

### 2.3 角色等级常量

| 常量 | 后端 | 前端 |
|------|------|------|
| 系统角色等级 | `backend/src/constants/roles.ts` `ROLE_LEVEL` | `frontend/src/utils/roles.ts` `SYS_ROLE_LEVEL` |
| 项目角色等级 | `backend/src/constants/roles.ts` `PROJECT_ROLE_LEVEL` | `frontend/src/utils/roles.ts` `PROJECT_ROLE_LEVEL` |
| 角色字符串 | `SystemRole` / `ProjectRole` | `SystemRole` / `ProjectRole` |

等级值：`super_admin=3 / admin=2 / user=1`；`admin=3 / maintainer=2 / member=1`。

> 两处常量必须保持与后端一致，改动后端时必须同步前端 `utils/roles.ts`。

---

## 3. 维度二：实现方案（菜单 / 功能 / 数据权限）

### 3.1 菜单权限（sidebar 可见性，前端 `AppSidebar.vue` + `useProjectPermission`）

| 菜单 | 系统角色 | 项目角色 |
|------|:-------:|:--------:|
| 用户管理 | SuperAdmin / Admin | — |
| 项目管理 | Any | — |
| 翻译管理 | Any | Any |
| 项目成员 | Any | Admin |
| 语言管理 | Any | Admin / Maintainer |
| 导入管理 | Any | Admin / Maintainer |
| 导出模板 | Any | Any |

> 菜单可见性不代表可进页面——页面访问还受路由拦截（见 §5）约束。

### 3.2 功能权限（按钮/操作可用性，前端 `useProjectPermission`）

| 页面 | 操作 | 系统角色 | 项目角色 |
|------|------|:-------:|:--------:|
| 项目管理 | 编辑/删除项目 | SuperAdmin | — |
| 项目管理 | 新建项目 | SuperAdmin | — |
| 翻译管理 | 新增/删除 Key | — | Admin / Maintainer |
| 翻译管理 | 编辑 Key/原文/标签/备注列 | — | Admin / Maintainer |
| 翻译管理 | 排序行 | — | Admin / Maintainer |
| 翻译管理 | 保存译文 | — | 任意成员 |
| 导出模板 | 新增/删除/编辑模板 | — | Admin / Maintainer |
| 导出模板 | 预览/生成（使用模板） | — | 任意成员 |

前端统一通过 `hooks/useProjectPermission.ts` 获取权限 computed
- 常用项：`canManageContent`、`canManageProject`、`canSeeMemberManagement` 等
- 不要在页面里直接判断 `auth.role`

### 3.3 数据权限（可见数据范围）

数据权限决定「能看见哪些数据」，与菜单/功能权限（能否看见入口、能否操作）相互独立。当前存在四类数据权限：

**① 项目列表数据权限**（前端项目选择器 / 项目管理首页）：
- 只能看到自己有 **成员（owner 或 project_members）** 身份的项目，即 `WHERE projects.userId = me OR id IN (我的 project_members.projectId)`；
- 后端 `services/project.ts` `listProjects` 返回列表时会**附加**当前用户在每项目中的 `projectRole`（super_admin / owner → admin）
- 该字段供前端权限判断使用
- 前端 `stores/project.ts` 统一维护该列表（单数据源），`auth.projectRole` 由此派生，`useProjectPermission` 用它算菜单/功能权限；
- 注意：即使 super_admin 后端可访问任意项目（URL 直达放行），**项目列表也仅显示自己有成员/owner 身份的项目**——数据可见性与接口可达性分离。

**② 项目内数据权限**：进入某项目后，所能触达的翻译/语言/成员/导出模板等数据受该项目访问权约束（§4 项目权限），非成员无法进入该项目任何页面/接口。

**③ 开放接口数据权限**（API Key，详见 §4.4）：
- 开放接口调用时，后端以 **API Key 所有者的 `userId` / `userRole`** 走 `assertProjectAccess`；
- 因此 API Key **不会获得超越其所有者的项目数据权限**——只能访问所有者拥有成员/owner 身份的项目（super_admin 所有者的 API Key 可访问全部项目），非成员项目返回 403。

**④ API Key 管理数据权限**（`/me/keys` CRUD）：
- 每个用户的 API Key 列表、启停、删除均按 `where: { userId: req.userId }` 过滤，**只能管理自己的 Key**（owner-scoped），不可见他人 Key。

**⑤ 用户管理操作数据权限**（`/auth/users*`，系统 admin+）：
- 操作级限制在 `services/auth.ts` `canManage(operator, target)`：
  - admin 可管理除 super_admin 外的所有用户
  - 不能把他人角色提升到高于自己；只能创建 user 角色
- 列表本身全量可见，但**可操作范围**按此收敛

---

## 4. 维度三：接口层面（后端鉴权链）

后端权限链为 tsoa 注解式：

```
@Security('auth' | 'admin')        ← expressAuthentication：解析 JWT / API Key，回写 req.userId / req.userRole
  ↓
assertSystemRole(role, minRole)     ← 系统级门槛（用户管理、项目增删改）
assertProjectAccess(userId, userRole, slug, minProjectRole?)  ← 项目级约束
  ↓
handler
```

### 4.1 接口级系统权限

| 级别 | 实现 | 适用接口 |
|------|------|---------|
| 公开 | 无 `@Security` | `POST /auth/register/login/refresh` |
| 登录即可 | `@Security('auth')` | 除公开/用户管理外所有接口 |
| 系统 admin+ | `@Security('admin')` | 用户管理 5 个：`GET/POST /auth/users`、`PUT /auth/users/{id}/role|password`、`DELETE /auth/users/{id}` |
| 系统 super_admin | `@Security('auth')` + `assertSystemRole(role, SystemRole.SuperAdmin)` | `POST /projects`（创建）、`PUT/DELETE /projects/{slug}`（编辑/删除） |

### 4.2 接口内项目权限（`assertProjectAccess`，`backend/src/lib/access.ts`）

对项目路径参数（Slug：id 或 code）先解析项目，再判定：

1. **super_admin** → 恒放行，返回 `projectRole = Admin`；
2. **owner**（`projects.userId === userId`）→ 放行，返回 `Admin`；
3. **其余** → 查 `project_members`，无记录抛「无项目权限」；有记录则按 `minProjectRole` 比较等级，不足抛「项目权限不足」。

`minProjectRole` 传参约定：

| `minProjectRole` | 业务含义 | 涉及接口 |
|:--:|------|---------|
| 不传 | 项目内任意成员可访问（读接口 + 保存译文 + 导出预览/生成） | 详情/列表/导出等 |
| `Maintainer` | 内容管理（增删改 Key、排序、批量、key 级属性、语言增删改/别名/排序、导入、导出模板增删改） | `Translations` / `Languages` / `Imports` / `Exports.templates` 的写接口 |
| `Admin` | 项目成员管理 | `POST/PUT/DELETE /projects/{slug}/members*` |

### 4.3 开放接口（API Key）权限

外部自动化通过 `x-api-key` + `x-api-secret` 访问 `/api/v1/apikey/...` 前缀接口。

- 可访问范围由**白名单**决定：`backend/src/lib/apikey-whitelist.ts` 的 APIKEY_WHITELIST 数组
- 每条声明「HTTP 方法 + 路径正则」，逐条列举允许的开放接口
- 新增开放接口只需追加一条声明（index.ts 守卫与 services/docs.ts 抽取共用），无需改逻辑

**开放接口的数据权限**

- 开放接口路径均为 `/projects/{id}/...`，调用时 `apiKeyAuth` 解析出 Key 所有者的 `userId` / `userRole`
- 后续 `assertProjectAccess` 以**该所有者身份**判定项目访问权与角色门槛，因此：
  - API Key 只能操作所有者拥有成员/owner 身份的项目（super_admin 所有者的 Key 可访问全部项目）
  - 非成员项目返回 403；API Key 不会获得超越所有者的能力
- API Key 只能操作**其所有者拥有成员/owner 身份的项目**（super_admin 所有者的 Key 可访问全部项目），非成员项目返回 403；
- API Key 不会获得超越所有者系统/项目角色的能力，只是把所有者的身份「复用到自动化调用」。

---

## 5. 前端路由拦截（URL 直达防线）

即使绕过侧边菜单，直接敲 URL 也进不了无权页面。`router/index.ts` 守卫 `hasRoutePermission`：

- 路由 `meta.perm` 声明页面权限，取值：

| `meta.perm` | 含义 |
|------------|------|
| `sys:admin` | 系统 admin+（用户管理） |
| `sys:super_admin` | 仅超管（新建项目） |
| `proj:admin` | 该项目 admin（项目成员） |
| `proj:maintainer` | 该项目 maintainer+（语言/导入/编辑模板） |
| `proj:member` | 该项目任意成员（翻译/导出模板） |

- **项目成员兜底**：任何路径含 `:projectSlug` 的项目内页面，若当前用户非该项目成员/owner 且非 super_admin，一律拦截（即使漏设 `meta.perm`）。
- `sys:*` 用 `SYS_ROLE_LEVEL` 比较；`proj:*` 用 URL 项目角色与 `PROJECT_ROLE_LEVEL` 比较
- 项目角色取自 `projectStore.getProject(slug)?.projectRole`
- 无权限一律重定向首页 `/`。

> 项目级判断基于 **URL 中的项目**（而非当前活动项目），防止通过 URL 访问其他项目。

---

## 6. 前后端权限对照表

| 页面 / 接口 | 系统权限 | 项目权限 | 前端菜单 | 前端功能 | 路由 `meta.perm` |
|------------|:------:|:------:|:--:|:--:|:--:|
| 用户管理 | admin+ | — | ✅ | — | `sys:admin` |
| 新建项目 | super_admin | — | — | ✅ | `sys:super_admin` |
| 项目管理（列表） | 登录 | — | ✅ | — | — |
| 翻译管理（读/保存译文） | 登录 | 任意成员 | ✅ | ✅ | `proj:member` |
| 翻译 Key 增删改/排序/批量 | 登录 | Maintainer+ | ✅ | ✅ | 页面级 `proj:member`，操作级在页面内按 `canManageContent` |
| 语言管理 | 登录 | Maintainer+ | ✅ | ✅ | `proj:maintainer` |
| 导入管理 | 登录 | Maintainer+ | ✅ | ✅ | `proj:maintainer` |
| 导出模板（使用） | 登录 | 任意成员 | ✅ | ✅ | `proj:member` |
| 导出模板增删改/编辑页 | 登录 | Maintainer+ | ✅ | ✅ | `proj:maintainer` |
| 项目成员 | 登录 | Admin | ✅ | ✅ | `proj:admin` |
| 开放接口说明 | 登录 | — | — | — | — |

> 「翻译管理」页路由门槛是成员即可进入，但页内 Key 增删改/排序等按钮按 `canManageContent`（Maintainer+）控制——体现菜单/功能权限分层。

---

## 7. 权限维护指引

### 新增一个受限页面（前端）
1. 路由加 `meta.perm`（`sys:admin` / `sys:super_admin` / `proj:admin` / `proj:maintainer` / `proj:member`）；
2. 若依赖项目角色，路径必须带 `:projectSlug`；
3. 在 `AppSidebar.vue` 菜单与 `useProjectPermission` 增加对应可见性/功能权限。

### 新增一个受限接口（后端）
1. 选择 `@Security('auth' | 'admin')`；
2. 项目级接口在 handler 内调用 `assertProjectAccess(req.userId!, req.userRole!, slug, minProjectRole?)`
   - 按业务传 `ProjectRole.Maintainer` / `Admin`，或不传（任意成员）
3. 涉及系统 super_admin 的操作加 `assertSystemRole(role, SystemRole.SuperAdmin)`；
4. 改完控制器必须 `cd backend && pnpm gen` 重新生成 `docs/routes.ts` + `swagger.json`；
5. 若为 API Key 开放接口，同步补充 `APIKEY_WHITELIST`。

### 改动角色/等级
同时同步：
- 后端 `backend/src/constants/roles.ts`；
- 前端 `frontend/src/utils/roles.ts`（字符串常量 + `SYS_ROLE_LEVEL` / `PROJECT_ROLE_LEVEL`）；
- 权限矩阵表（`CLAUDE.md` 角色权限章节、本文档）。

---

## 8. 关键文件索引

| 文件 | 职责 |
|------|------|
| `backend/src/constants/roles.ts` | 系统/项目角色常量与等级 |
| `backend/src/lib/access.ts` | `assertProjectAccess` / `assertSystemRole` |
| `backend/src/controllers/AuthController.ts` | `@Security('admin')` 用户管理 |
| `backend/src/controllers/ProjectsController.ts` | 项目 CRUD（super_admin）+ 成员管理（Project Admin） |
| `backend/src/services/project.ts` | `listProjects` 附加当前用户 `projectRole`（数据权限） |
| `backend/src/services/docs.ts` | 从 swagger.json 派生 API Key 开放接口文档（`buildApiKeyOpenApiSpec`） |
| `backend/src/lib/apikey-whitelist.ts` | API Key 开放接口白名单 |
| `frontend/src/hooks/useProjectPermission.ts` | 菜单/功能权限 computed |
| `frontend/src/utils/roles.ts` | 角色常量 + `SYS_ROLE_LEVEL` / `PROJECT_ROLE_LEVEL` |
| `frontend/src/router/index.ts` | 路由守卫 + `meta.perm` 拦截 |
| `frontend/src/stores/project.ts` | 项目列表单数据源（`projectRole` 数据权限） |
