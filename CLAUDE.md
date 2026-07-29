# 翻译管理平台 — AI 开发指南

## 项目概述

本地化翻译管理平台，前后端分离。Vue 3 + Express + PostgreSQL + Prisma。

## 代码规范

### 密码规范

密码长度 **至少 6 位**，无最大长度限制，无可用字符限制。前后端同时校验，后端所有密码入口（注册、改密、创建用户）统一检查 `password.length < 6`。

### TypeScript

禁止使用 `any`，如无法确定类型则使用 `unknown`。`catch (e: any)` 一律改为 `catch (e: unknown)` 配合类型断言访问属性。已在 `tsconfig.json` 中开启 `strict: true`（含 `noImplicitAny`），不允许隐式 `any`。

### 行尾

文本文件统一使用 LF（`\n`）换行，文件末尾保留一个空行。`.gitattributes` 已配置 `* text=auto eol=lf`，新增或修改的文件会自动标准化。

如需手动转换现有文件：
```bash
# 将已跟踪文件的行尾标准化为 LF
git add --renormalize .
```

## 常用命令

```bash
# Docker（端口在 .env 中配置，默认 21080/21010/21432）
docker compose up -d             # 启动全部服务（生产部署）
docker compose up -d --build     # 重新构建镜像并启动
docker compose up -d postgres    # 仅启动数据库（本地开发用，AI 自动执行）
docker compose down              # 停止所有服务
docker compose logs -f           # 查看日志

# 后端 (localhost:8080)
cd backend && pnpm dev           # tsx watch 热重载（开发者手动启动）
pnpm db:generate                 # 重新生成 Prisma Client
pnpm db:push                     # 推送 schema 到 DB（仅本地快速原型用，不产生迁移文件）
pnpm db:migrate                  # 交互式：创建新迁移文件 + 应用到 DB（用于改 schema 后）
pnpm prisma migrate deploy       # 非交互式：将已有迁移应用到 DB（本地初始化/Docker 启动时自动执行）

# 前端 (localhost:3000)
cd frontend && pnpm dev          # Vite HMR（开发者手动启动）
rm -rf node_modules/.vite        # 清除 Vite 缓存（模块找不到时）

# 导入翻译文件
cd backend && pnpm tsx src/scripts/import-json.ts <projectId> <file> <langCode>

# Lint + 类型检查（提交前必须执行）
cd backend && pnpm lint            # ESLint + tsc
cd backend && pnpm lint:fix        # 自动修复 + tsc（仅修复格式，剩余需手动处理）
cd frontend && pnpm lint           # ESLint + vue-tsc
cd frontend && pnpm lint:fix       # 自动修复 + vue-tsc（仅修复格式，剩余需手动处理）
```

## 核心架构

### 数据层

```
translation_keys              translation_values
┌──────────────────┐  1:N  ┌──────────────────┐
│ id (UUID PK)     │───────│ id (UUID PK)     │
│ project_id (FK)  │       │ key_id (FK)      │
│ key              │       │ language_code    │
│ source_text      │       │ translated_text  │
│ context          │       │ is_reviewed      │
│ tags (TEXT[])    │       │ created_at       │
│ created_at       │       └──────────────────┘
└──────────────────┘

context 和 tags 为 Key 级别属性，跨语言共享
project_languages (alias 别名字段) — 导出和 UI 优先显示别名
```

### 后端分层

```
routes/ → services/ → Prisma Client
middleware/auth.ts         — JWT 验证，从 token 提取 userId 和 userRole
middleware/ownership.ts    — 检查用户是项目 owner 或 member
middleware/role.ts         — requireRole(minRole) 角色等级检查
```

### 前端分层

```
views/ → stores/ → api/ → Express (/api/v1/*)
components/common/ — AppHeader(项目切换+设置), AppSidebar(菜单+权限)
layouts/AuthLayout — 登录/注册卡片布局
layouts/AppLayout — 主界面布局
```

### 角色权限

系统角色与项目角色分离。

**系统角色** (`users.role`):

| 角色 | 新建/编辑项目 | 用户管理 | 说明 |
|------|:--:|:--:|------|
| super_admin | ✅ | ✅ | 首位注册用户自动成为超管 |
| admin | ❌ | ❌ | 可管理用户，不能管理 super_admin |
| user | ❌ | ❌ | 默认角色（普通用户） |

权限常量: `ROLE_LEVEL = { super_admin:3, admin:2, user:1 }`

**项目角色** (`project_members.project_role`):

| 角色 | 项目成员 | 语言管理 | 导入 | Key管理 | 翻译 | 导出模板 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| maintainer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| member | ❌ | ❌ | ❌ | ❌ | 仅编辑译文 | 仅使用模板 |

项目 owner 自动拥有项目 admin 权限。系统 super_admin 对所有项目拥有全部权限。

**三层权限模型：**

1. **菜单权限**（sidebar 可见性）：

   | 菜单 | 系统角色 | 项目角色 |
   |------|:-------:|:--------:|
   | 用户管理 | SuperAdmin/Admin | — |
   | 项目管理 | Any | — |
   | 翻译管理 | Any | Any |
   | 项目成员 | Any | Admin |
   | 语言管理 | Any | Admin/Maintainer |
   | 导入管理 | Any | Admin/Maintainer |
   | 导出模板 | Any | Any |

2. **功能权限**（按钮/操作）：
   | 页面 | 操作 | 系统角色 | 项目角色 |
   |------|------|:-------:|:--------:|
   | 项目管理 | 编辑项目 | SuperAdmin | — |
   | 翻译管理 | 新增/删除Key | — | Admin/Maintainer |
   | 翻译管理 | 编辑Key/原文/标签/备注列 | — | Admin/Maintainer |
   | 翻译管理 | 排序行 | — | Admin/Maintainer |
   | 导出模板 | 新增/删除/编辑模板 | — | Admin/Maintainer |

3. **数据权限**：
   - 项目选择器：Project-Any（只能看到自己有成员/owner 身份的项目）

**前端权限工具**：使用 `hooks/useProjectPermission.ts` 的 `useProjectPermission()` 获取所有权限 computed，替代直接判断 `auth.role`。提供 `canManageContent`（Admin/Maintainer 或 super_admin）、`canManageProject`（Admin 或 super_admin）等权限属性。

**后端中间件链**：`authMiddleware` → `requireOwnership` → `requireProjectRole(minRole)` → handler。`requireProjectRole` 自动放行 super_admin。敏感路由（创建 Key、管理成员、语言、导入、模板增删改）已加上对应 `requireProjectRole` 保护。

### Slug

`:projectSlug`、`:templateSlug` 等路径参数统称为 Slug，**同时接受 UUID（id）和 `code`**：接口内先按 UUID 查，未命中再按 code 查。记录 `code` 字段可选，创建时会自动生成。

显示时优先展示 code（可读标识符），如 `my-project`；没有 code 时才回退到 UUID。

Slug 解析统一使用 `services/project.ts` 导出的 `resolveProject(identifier)`。模板 slug 同理，使用 `services/export/index.ts` 导出的 `resolveTemplate(templateSlug, projectSlug)`。

### API 路由

所有接口 `/api/v1/*`，统一响应 `{ code: 0, message, data }`。

```
/auth/register|login|refresh|me        — 公开 (除了 me)， login 支持用户名或邮箱
/auth/users|users/:id/role|users/:id/password  — 需 auth + admin+
/projects CRUD                          — 需 auth
/projects/:id/translations              — 需 ownership
/projects/:id/translations/key/:oldKey  — PUT 更新 Key (必须在 /:key/:langCode 之前)
/projects/:id/translations/:key/:langCode — PUT 保存译文/标签/备注
/projects/:id/translations/tags/list     — GET 标签列表
/projects/:id/languages/:code/alias      — PUT 语言别名
/projects/:id/languages/:code/sortOrder  — PUT 语言排序
/projects/:id/members                    — GET/POST 项目成员管理
/projects/:id/members/:id/role           — PUT 修改成员项目角色
/projects/:id/exports/preview|generate   — POST
```

### 翻译页面关键逻辑

- 后端 `listGrouped` 按 key 聚合，返回 `translationKey + sourceText + context + tags + translations{}`
- 译文用 `transCache` (key+lang → text) 缓存
- context 和 tags 是 key 级属性，不按语言缓存
- 仅未翻译：后端过滤 `k.values` 中该语言 `translatedText` 为空或不存在

### API Key 鉴权

外部自动化可通过 API Key + Secret 访问导出端点：

所有接口 `/api/v1/*` 可通过 API Key 鉴权访问，将路径前缀改为 `/api/v1/apikey/`：

```bash
# 导出翻译
curl -X POST http://localhost:21080/api/v1/apikey/projects/:projectId/exports/generate \
  -H "x-api-key: ak_xxx" \
  -H "x-api-secret: xxx" \
  -H "Content-Type: application/json" \
  -d '{"templateSlug":"...","languageCodes":["zh-Hans"]}'
```

白名单配置在 `backend/src/index.ts` 的 `APIKEY_WHITELIST` 数组。管理接口：`/api/v1/apikey/me/keys` CRUD（需 JWT 登录）

### 导出格式

系统支持 8 种导出格式，定义在 `frontend/src/data/exportFormats.ts` 的 `EXPORT_FORMAT_MAP`：

| 格式 | 文件后缀 | 单/多语言 | 说明 |
|------|:------:|:--------:|------|
| `flat-json` | `.json` | 单 | 扁平的 key-value 映射 |
| `nested-json` | `.json` | 多 | 按语言嵌套的 key-value 映射 |
| `flat-yaml` | `.yaml` | 单 | 扁平的 key-value 映射 |
| `nested-yaml` | `.yaml` | 多 | 按语言嵌套的 key-value 映射 |
| `properties` | `.properties` | 单 | Java 键值对格式，特殊字符自动转义 |
| `flat-xml` | `.xml` | 单 | Android `resources/string` 标签结构 |
| `nested-xml` | `.xml` | 多 | 按语言嵌套的 XML 标签结构 |
| `csv` | `.csv` | 多 | 表格，key / source / 各语言各一列 |

### 导出模板 config 字段

```json
{ "skipIdentical": true, "skipEmpty": true, "useCodeKey": false }
```

### 常见问题

1. **Vite 模块找不到** — `rm -rf node_modules/.vite && pnpm dev`
2. **Prisma 文件锁** — `rm -rf node_modules/.prisma && pnpm prisma generate`
3. **`psql` 中文乱码** — 用 `pnpm tsx -e "import{PrismaClient}..."` 查数据
4. **路由冲突** — `/:key/:langCode` 会吃掉 `/key/:oldKey`，必须把 literal 路由放前面
5. **`cannot edit` 报错** — GateGuard hook，用 `ECC_GATEGUARD=off` 前缀或加到 `settings.json`
6. **前端 TS 报错（`Property 'xxx' does not exist on type`）** — 改 schema 后未同步 `frontend/src/types/models.d.ts`，检查并添加对应字段

### 前端关键文件

| 文件 | 职责 |
|------|------|
| `stores/auth.ts` | 用户信息、系统角色、项目角色、activeProjectId |
| `stores/translation.ts` | 翻译列表、GroupedRow 类型 |
| `stores/loading.ts` | 全局 loading 遮罩 |
| `composables/useProjectPermission.ts` | 三层权限模型（菜单/功能/数据权限） |
| `api/client.ts` | Axios 实例、401 自动 refresh token |
| `router/index.ts` | 路由守卫、auth.init() 初始化 |

### 改动翻译相关功能

1. 先改 `services/translation.ts` → 再改 `routes/translations.ts` → 最后改前端
2. 改 `prisma/schema.prisma` → `pnpm db:migrate` 生成迁移文件 → 更新 service。必须创建迁移文件（不要用 `db:push` 绕过），否则 Docker 部署时 `migrate deploy` 会遗漏变更
   - 注意：`db:push` 后的 DB 没有 `_prisma_migrations` 记录，直接用 `migrate deploy` 会因列已存在报错，需先用 `migrate resolve --applied` 手动标记已存在的迁移
3. 翻译列表分页在 `listGrouped` 中处理，导出不过滤在 `getForExport`

### 改 Prisma Schema 后必须做的事

1. 生成迁移文件：`cd backend && pnpm db:migrate`（绝对不能用 `db:push` 代替）
2. 同步 `frontend/src/types/models.d.ts` — 新增或改动的字段必须加上，否则前端 TypeScript 编译报错

### 改动代码后必须做的事

- 修改代码后同步更新本文档（CLAUDE.md）和 README.md
- 改 Prisma schema 后必须创建迁移文件（`pnpm db:migrate`），不能用 `db:push` 代替

### 语言管理

- 基础语言列表在 `frontend/src/data/languages.json`，静态加载，不依赖后端 API
- 项目语言支持 `alias` 别名和 `sortOrder` 排序，导出时别名优先
- 语言管理页支持拖拽排序（上下箭头），排序值通过 `PUT /languages/:code/sortOrder` 保存

### 项目成员

- 添加成员时需指定 `projectRole`（admin / maintainer / member）
- 项目角色控制该成员在项目内的操作权限
- API: `POST /projects/:id/members` 传 `{ email, projectRole }`
- API: `PUT /projects/:id/members/:memberId/role` 传 `{ projectRole }`

### 脚本

`scripts/` 下的工具脚本需同时提供 `.sh`（Linux）和 `.ps1`（Windows）两个版本。

**命名规范**：脚本文件名使用下划线（snake_case），如 `sync_all.sh`、`backup_db.ps1`。

**中文提示**：所有用户可见的提示信息（usage、错误、步骤、完成等）使用中文书写。

**文档同步**：新增或修改脚本后，同步更新 `docs/SCRIPTS_GUIDE.md`，包括用法说明、依赖变更和示例。

**API 脚本参数规范**：涉及 API 调用的扩展脚本，必填参数包含 `Endpoint` + `ApiKey`/`ApiSecret`（或 `AuthConfig` 文件），且鉴权参数排列在项目/模板参数之前。具体顺序参考已有脚本或 `docs/SCRIPTS_GUIDE.md` 表格。

#### 扩展脚本

- 无特殊前缀
- 基于已部署服务（Docker 接口、前端页面）的运维与集成操作
- 在 `docs/SCRIPTS_GUIDE.md` 中归入「扩展脚本」章节

#### 开发脚本

- 以 `dev_` 前缀命名，仅用于本地开发环境
- 基于本地项目代码和开发环境，在开发周期中使用（如数据导入、同步、本地调试等），依赖本地已安装的依赖和运行中的开发服务
- 通过 `$(dirname "$0")`（sh）或 `$PSCommandPath`（ps1）自动定位项目子目录，在项目根目录下直接运行即可，无需先 `cd` 到对应子目录
- 在 `docs/SCRIPTS_GUIDE.md` 中归入「开发脚本」章节
