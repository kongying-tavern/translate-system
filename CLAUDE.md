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
cd backend && pnpm dev           # tsx watch 热重载（开发者手动启动，predev 会自动先跑 pnpm gen）
pnpm gen                         # 重新生成 tsoa docs/routes.ts + swagger.json（改控制器后必须执行）
pnpm db:generate                 # 重新生成 Prisma Client
pnpm db:push                     # 推送 schema 到 DB（仅本地快速原型用，不产生迁移文件）
pnpm db:migrate                  # 交互式：创建新迁移文件 + 应用到 DB（用于改 schema 后）
pnpm prisma migrate deploy       # 非交互式：将已有迁移应用到 DB（本地初始化/Docker 启动时自动执行）

# 前端 (localhost:3000)
cd frontend && pnpm dev          # Vite HMR（开发者手动启动）
rm -rf node_modules/.vite        # 清除 Vite 缓存（模块找不到时）

# pnpm patch（修改依赖源码，如 data-visor-vue@0.0.4）
cd frontend && pnpm patch data-visor-vue@0.0.4   # 创建/打开 patch 工作目录 node_modules/.pnpm_patches/
# 在 patch 工作目录里修改 dist/index.js 等源码后：
cd frontend && pnpm patch-commit "node_modules\.pnpm_patches\data-visor-vue@0.0.4"  # 生成/更新 patches/*.patch
cd frontend && pnpm install      # 将 patch 应用到 node_modules（若 node_modules/.pnpm_patches 已存在则直接编辑后 patch-commit）
rm -rf node_modules/.vite        # patch 生效后必须清 Vite 缓存，否则 dev server 仍用旧代码

# 注意：patch 目录存在时再次 pnpm patch 会报 ERR_PNPM_EDIT_DIR_NOT_EMPTY，
# 直接编辑现有 .pnpm_patches/<pkg> 目录再 patch-commit 即可（会叠加到同一 patch 文件）

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
│ context          │       │ translated_text  │
│ tags (TEXT[])    │       │ is_reviewed      │
│ created_at       │       └──────────────────┘
└──────────────────┘

context 和 tags 为 Key 级别属性，跨语言共享
原文 = 源语言语言值（源语言 value 的 translatedText），无独立存储
project_languages (codeAlias 字段，列 code_alias，由 `20260824000000_rename_project_language_code_alias` RENAME 改名) — 导出和 UI 优先显示代码别名
```

**索引约定**（Postgres 不自动为 FK 列建索引）：`translation_keys` 有复合索引 `(project_id, sort_order, key)`（listGrouped/导出排序过滤，`20260822000000`）与 unique `(project_id, key)`；`project_members` 有 `user_id` 单列索引（fetchProjects「查我的项目」走 WHERE user_id，auth.init + 每 30s 权限轮询热路径，unique 以 project_id 为首列覆盖不了它；`20260823010000`）；`translation_values` 所有查询均以 `key_id` 打头（导入批量 upsert 的 ON CONFLICT / 元组 IN 同样命中），由 unique `(key_id, language_code)` 首列覆盖，勿重复单建 key_id 索引

### 后端分层（tsoa 注解式路由）

```
controllers/ → services/ → Prisma Client
authentication.ts          — tsoa expressAuthentication：@Security('auth'/'admin')，解析 JWT 或复用 apiKey 预置身份，回写 req.userId/userRole
lib/access.ts              — assertProjectAccess(userId, userRole, slug, minProjectRole?) / assertSystemRole(role, minRole)
lib/api.ts                 — ok<T>() / okPage<T>() 统一响应包装 { code, message, data }
lib/prisma.ts              — PrismaClient 单例（独立文件，避免 tsoa 扫描循环依赖）
docs/swagger.ts          — 手写包装（import swagger.json + 加 basePath，并补充 tags 分组/安全方案/描述），必须提交
docs/routes.ts + swagger.json — tsoa 生成产物（`pnpm gen` 重新生成，勿手改），已 gitignore（`backend/src/docs/*` + `!swagger.ts`），由 `predev`（开发启动）和 Dockerfile `RUN pnpm gen`（镜像构建）自动生成
middleware/auth.ts         — AuthRequest 类型（各控制器 `@Request() req: AuthRequest` 注入，读 userId/userRole；鉴权统一走 authentication.ts 的 expressAuthentication，无独立中间件函数）
middleware/decodePathParams.ts — 统一解码 URL 路径参数（`b64_` 前缀才解码），经类级 `@Middlewares(decodePathParams)` 挂在所有含 `@Path` 参数的 controller 上（ApiKeys/Auth/Exports/Imports/Layouts/Projects/Translations），在 handler 前改写 `req.params`
middleware/errorHandler.ts — 适配 AppError（业务错误 200 + code，鉴权失败 401）与 tsoa ValidateError（→ 1000，英文校验信息格式化为中文，如「缺少必填参数：templateSlug、languageCodes」）；body-parser 错误（`express.json({ limit: '200mb' })`，index.ts）返回统一 JSON：超限 413「请求体过大」、非法 JSON 400；AppError/ValidateError/body-parser 均为预期路径只记单行 `console.warn`（含 method/url/code/message），**不打堆栈**——access token 每 15min 过期的常规 401 靠前端静默刷新消化，勿改回无条件 `console.error`；仅未预期异常才打完整堆栈并返回 500
```

**tsoa 用法**：控制器用 `@Route` / `@Get|@Post|@Put|@Delete` / `@Path` / `@Query` / `@Body` / `@Security` 注解，改完控制器后必须 `cd backend && pnpm gen` 重新生成 `docs/routes.ts`（挂载用）和 `docs/swagger.json`（OpenAPI）。

**注意**：
- 字面量类型陷阱：`{ deleted: true }` 这类内联字面量会让 tsoa 崩溃（`isEnumMember` TypeError），必须命名接口（如 `DeletedResult`）。
- tsoa 不支持可选路径参数（`{langCode?}`），需拆成两条路由：`PUT .../{keyId}`（key 级属性）与 `PUT .../{keyId}/{langCode}`（语言级）。
- 路由注册顺序 = 方法声明顺序，literal 路由（`sortOrders`、`batch`、`count`）必须声明在参数路由（`{keyId}`、`{keyId}/{langCode}`）之前，否则被吃掉。
- 响应类型用 `Date`（tsoa 序列化为 ISO），`description` 等可空字段用 `string | null`；Prisma 返回行与自定义 Row 接口不一致时用 `as unknown as` 转换。
- OpenAPI 字段描述来源：接口/模型属性上方的 `/** 中文说明 */` JSDoc 会映射到 schema 的 `description`；tsoa 无法穿透 Prisma 生成的 client 类型，直接暴露的 Prisma 模型（如 `ProjectLanguage`）应改为控制器内自定义 Row 接口（如 `ProjectLanguageRow`）并加 JSDoc，服务层返回的 Prisma 行结构兼容可直接断言赋值。字段示例用属性 JSDoc 里的 `@example` 标签（**必须是合法 JSON**，字符串要加引号，如 `@example "my-template"`、`@example ["zh-Hans", "en"]`），导入工具时会作为默认值预填。
- Path/Query 参数描述来自方法 JSDoc 的 `@param 参数名 中文描述`（`@Body` 用 `@param body` 会成为 requestBody 描述）；`@Request() req` 用 `@param req`。ESLint jsdoc 规则要求 `@param` 覆盖方法全部参数（req → path/query → body）且多行块 `/**` 独占一行，`@summary` 保持最后一个标签，否则 `pnpm lint` 报 warning。
- 编辑类操作统一用 **keyId 定位**（Key 长度不可控且可含任意字符，避免路径参数编码问题；keyId 固定 UUID，改名不变）：key 级属性走 `PUT .../translations/{keyId}`，译文走 `PUT .../translations/{keyId}/{langCode}`。

### 前端分层

```
views/ → stores/ → api/ → Express (/api/v1/*)
components/common/ — 统一从 `@/components/common` barrel（index.ts 命名导出）引入，禁止深路径 import（common 目录内部互引用相对路径，避免 barrel 循环依赖）：AppHeader(项目切换+设置), AppSidebar(菜单+权限), AppTabs(顶部标签页, 基于 BaseTabButton；首位固定「首页」标签，点击进 DashboardView；右键菜单只显示可执行操作——首页无「关闭自身/关闭左侧」、最左侧/最右侧标签无对应关闭项、标签≤1 无「关闭其他」，不可操作用隐藏而非禁用)
layouts/AuthLayout — 登录/注册卡片布局
layouts/AppLayout — 主界面布局（Header + AppTabs 标签栏 + 内容区）
```

**项目数据单源（project store）**：用户可见的所有项目统一存 `stores/project.ts`（`projects` 数组 + `bySlug` computed map，key 为 slug=`code || id`）。`auth.init()` 启动时加载一次（`fetchProjects` 带 `loaded` 守卫），`auth` store 的 `activeProjectName` / `projectRole` 均为从 `bySlug[activeProjectSlug]` 派生出的 computed，不再各自存储重复状态。所有项目变更必须走 project store（`create`/`update`/`remove`），保证 map 一致；项目 **code 变更** 时 `AppHeader.saveSettings` 会同步：更新 `activeProjectSlug`（ref+localStorage）、`tabsStore.renameProjectSlug` 重写已打开标签路径、`router.replace` 到新 slug 路由。AppTabs 标签标题用 `auth.activeProjectName` 计算，项目名异步加载完成后自动刷新，`logout` 时 `projectStore.clear()` 防串号。

### 角色权限

> 完整的三维权限模型（作用层级 / 实现方案 / 接口层面）与维护指引见 `docs/PERMISSION_GUIDE.md`。以下是核心矩阵。

系统角色与项目角色分离。

**系统角色** (`users.role`):

| 角色 | 新建/编辑项目 | 用户管理 | 说明 |
|------|:--:|:--:|------|
| super_admin | ✅ | ✅ | 首位注册用户自动成为超管，可管理所有人 |
| admin | ❌ | ✅ | 可管理用户，但不能管理 super_admin，只能创建 user 角色、不能提升他人角色到高于自己 |
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

**后端权限链（tsoa）**：`@Security('auth'/'admin')`（expressAuthentication）→ 控制器内 `assertProjectAccess(userId, userRole, slug, minProjectRole?)` / `assertSystemRole(role, minRole)` → handler。`assertProjectAccess` 内部自动放行 super_admin，返回 `{ projectId, projectRole }`。敏感路由（创建 Key、管理成员、语言、导入、模板增删改）已传 `ProjectRole.Maintainer`/`ProjectRole.Admin`。

### Slug

`:projectSlug`、`:templateSlug` 等路径参数统称为 Slug，**同时接受 UUID（id）和 `code`**：接口内先按 UUID 查，未命中再按 code 查。记录 `code` 字段可选，创建时会自动生成。

显示时优先展示 code（可读标识符），如 `my-project`；没有 code 时才回退到 UUID。

Slug 解析统一使用 `services/project.ts` 导出的 `resolveProject(identifier)`（先按 UUID 正则判断，合法 UUID 才查 id，否则直接按 code 查，避免 UUID 列抛错）。模板 slug 同理，使用 `services/export/index.ts` 导出的 `resolveTemplate(templateSlug, projectSlug)`。

**URL 路径参数编码**：路径参数（项目 slug、Key、语言代码、各 id）可能包含 `/`、空格、非 ASCII 等字符。前端所有路径参数拼进 API 路径或路由路径时必须用 `utils/path.ts` 的 `encPathParam()` 编码为单段：只含 URL unreserved 字符（`[A-Za-z0-9_.~-]`）的值原样返回，含特殊字符的值用 URL-safe Base64（去 padding、`+`→`-`、`/`→`_`）并加 `b64_` 前缀。**不能用百分号编码**：nginx 的 `merge_slashes` 与 URL 解码会把 `%2F` 改写成字面 `/` 并合并斜杠，导致含 `/` 的 key 经链路失真（UAT 实测），Base64 产物完全免疫。接口内所有 pathParam 位置统一用 `encPathParam`，禁止裸用 `encodeURIComponent`。后端所有 controller 经类级 `@Middlewares(decodePathParams)`（`middleware/decodePathParams.ts`）在 handler 前统一解码 `req.params`（`b64_` 前缀才解码，无前缀原样返回，兼容普通 slug/id 与旧客户端）。vue-router 只做百分号解码、不解 `b64_`，所有读取 `route.params` 处必须用 `decPathParam()` 还原（如各 view 的 `computed(() => decPathParam(route.params.projectSlug as string) as string)`、AppTabs 的 `decPathParam(resolved.params.projectSlug)`、路由守卫 `decPathParam(to.params.projectSlug)`）；tabs store 的 `isProjectPath`/`renameProjectSlug` 内部已按编码后路径比较/替换。

### API 路由

所有接口 `/api/v1/*`，统一响应 `{ code: 0, message, data }`。路由由 tsoa 从 `controllers/` 生成（`pnpm gen` 更新 `docs/routes.ts`）。

**`/openapi/*` 为开发者工具命名空间**：仅作 Swagger UI 与 OpenAPI JSON 文档的代理入口（`nginx.conf`/`vite.config.mts` 配置），不保证所有服务或所有 URL 在所有环境都可用。业务层一律不得依赖 `/openapi/*` 下的任何路径——后台页面经 JWT 接口拉取文档（如 `GET /api/v1/openapi-doc`），API Key 调用方直接请求后端 `/api/v1/apikey/*`。

**API 文档**：`/api-docs` 为开发者 OpenAPI 文档（Swagger UI），`index.ts` 用 `swaggerUi.setup(null, { swaggerOptions: { urls: [...] } })` 挂两个文档，顶部下拉切换：

- `./swagger.json` — **JWT 接口**，静态全量，不做角色过滤
- `./apikey.json` — **API Key 开放接口**，`services/docs.ts` 的 `buildApiKeyOpenApiSpec` 从 swagger.json 派生：白名单路径加 `/apikey` 前缀、operation 改用 `x-api-key`/`x-api-secret` 安全方案；相对 URL 被前端 `/openapi/swagger-ui/` 前缀代理命中

**暴露策略（`index.ts`，勿硬编码引用不存在的 JSON 路径）**：`/api-docs/apikey.json` **永远暴露**（外部 API Key 调用方与 Swagger UI「API Key 开放接口」标签依赖）。其余由两个开关显式控制，设 `true` 才暴露（默认不暴露），参数在根 `.env` 中配置，经 `docker-compose.yml` 透传为后端环境变量：

- `OPENAPI_SWAGGER` — 控制 Swagger UI 页面（`/api-docs`）挂载；swagger-ui 的 `urls` 数组只在 `OPENAPI_API_JSON` 开启时才引用 `./swagger.json`，避免正式环境加载 404 的 JWT 文档，`./apikey.json` 恒引用
- `OPENAPI_API_JSON` — 控制 `GET /api-docs/swagger.json`（JWT 全量原始文档）

**OpenAPI 描述增强（`docs/swagger.ts` 包装层，勿直接改 swagger.json）**：`pnpm gen` 只保证 operation summary（来自控制器 JSDoc `@summary`，每个接口必须有）、参数/字段中文描述（来自 Row 接口 JSDoc）。为满足导入 OpenAPI 工具（Apifox/Postman 等）的分组与说明需求，`docs/swagger.ts` 在导出 `swaggerSpec` 时补充 tsoa 不产出的内容：

- 顶层 `tags` 数组：按接口实际使用标签生成，`TAG_DESCRIPTIONS` 提供分组中文说明（Auth/Projects/Translations/Languages/Imports/Exports/Layouts/ApiKeys）
- `components.securitySchemes`：补 `auth`/`admin` JWT Bearer 方案定义（tsoa 生成为空，工具无法解析鉴权）
- `info.description`：统一响应结构说明
- 修正 `Record_string.*` 等 schema 的默认英文描述为中文

`services/docs.ts` 的 `buildOpenApi` 对 apikey.json 也会用 `buildTags(paths)` 计算子集标签，两文档分组一致。新增分组需同步补充 `TAG_DESCRIPTIONS`。

原始 OpenAPI JSON 暴露在 `GET /api-docs/swagger.json`（按需）与 `GET /api-docs/apikey.json`（恒暴露）（`index.ts` 中显式路由，须注册在 `swaggerUi.serve` 之前，否则被其 SPA 回退吞掉）。前端「开放接口说明」页（`/api-doc`，ApiDocView）经 JWT 接口 `GET /api/v1/openapi-doc`（`OpenApiController`，`@Security('auth')`，复用 `buildApiKeyOpenApiSpec` 派生逻辑）拉取 API Key OpenAPI 展示（`api/openapi.ts` 的 `getOpenApiSpec`）：路径直接用定义里的 `/apikey/...`，服务器基础路径取 spec 的 `servers`，不按角色过滤。新增开放接口需同步补充白名单。

```


POST   /auth/register|login|refresh    — 公开，login 支持用户名或邮箱
GET    /auth/me                        — 需 auth
GET    /auth/users                     — 需 auth + admin+
PUT    /auth/users/:id/role            — 修改用户角色（admin+，不能管理 super_admin、不能提升到高于自己）
POST   /auth/users                     — 创建用户（admin+，admin 只能创建 user 角色）
PUT    /auth/users/:id/password        — 重置密码（admin+）
DELETE /auth/users/:id                 — 删除用户（admin+，不能删除 super_admin）
GET    /projects                       — 需 auth（仅返回自己参与的项目）
POST   /projects                       — 创建项目（仅 super_admin）
PUT|DELETE /projects/:id               — 编辑/删除项目（仅 super_admin）
GET    /projects/:id                   — 需 auth + 项目访问（super_admin/owner 放行，成员按角色）
GET    /projects/:id/translations      — 需项目访问
POST   /projects/:id/translations      — 新增 Key（Maintainer+）
PUT    /projects/:id/translations/sortOrders — 批量排序（Maintainer+）
POST   /projects/:id/translations/batch      — 批量导入（Maintainer+）
PUT    /projects/:id/translations/{keyId}    — 更新 key 级属性 Key名/原文/标签/备注（Maintainer+，keyId 定位）
PUT    /projects/:id/translations/{keyId}/{langCode} — 保存译文（任意项目成员，仅传 translatedText；service 层拒绝源语言与非项目语言，防 member 改原文）
DELETE /projects/:id/translations/{translationId} — 删除 Key（Maintainer+）
GET    /projects/:id/translations/count|tags/list — 需项目访问
GET    /projects/:id/imports/status         — 查询项目导入状态（locked + 类型/发起人 id+用户名/时间 + `progress`；Maintainer+，前端据此 2s 轮询展示进度，空闲 30s）
POST   /projects/:id/imports/entries|translations — 批量导入（Maintainer+，同项目互斥锁：导入中再导入返回 Conflict，跨项目并发不受限；**接口立即返回 `accepted`，实际导入在后台异步执行，进度/结果全部经 `GET /imports/status` 轮询读取**）
POST   /projects/:id/imports/abort          — 中止当前项目导入（Maintainer+，且**仅发起人或 super_admin** 可中止；非本人/非超管返回 Forbidden，无进行中导入返回 Conflict）
GET|POST|PUT|DELETE /projects/:id/layouts/templates|configs — 布局模板/配置 CRUD（需项目访问）
GET    /projects/:id/languages         — 需项目访问
POST|DELETE /projects/:id/languages    — 增删语言（Maintainer+，源语言不可删除）
PUT    /projects/:id/sourceLanguage    — 设置源语言（Maintainer+，不在项目语言时自动添加并置顶）
PUT    /projects/:id/languages/:code/alias|sortOrder — 别名/排序（Maintainer+）
GET    /projects/:id/members           — 需项目访问
POST   /projects/:id/members           — 添加成员（Project-Admin）
PUT    /projects/:id/members/:id/role  — 修改成员角色（Project-Admin）
DELETE /projects/:id/members/:id       — 移除成员（Project-Admin）
GET    /projects/:id/exports/templates — 需项目访问
POST|PUT|DELETE /projects/:id/exports/templates — 导出模板增删改（Maintainer+）
POST   /projects/:id/exports/preview|generate — 需项目访问
GET|POST|PUT|DELETE /me/keys           — API Key CRUD（JWT）
GET    /openapi-doc                    — 开放接口文档（JWT，前端「开放接口说明」页使用）
GET    /languages|/languages/search    — 基础语言
```

### 导入解析校验（ImportsController `parseImportData`）

解析失败**不再静默返回空数组**，统一抛 `AppError(InvalidParams)` 中文提示（前端 ImportTemplateView 的 `showImportError` 优先展示服务端 message）：

- `sniffFormat` 自动识别：`{`/`[` → JSON、`<` → XML、缩进/列表/`key: value`（冒号+空格）→ YAML、`key=value` 或 `key:value`（冒号后非空格非 `/`）→ Properties、其余 → CSV
- 解析后校验：**0 条** → 「未从数据中解析到任何条目」；**空 key** → 「第 N 条缺少翻译键（key/name）」，均拒绝导入
- JSON/YAML 顶层非键值映射对象（数组/标量）直接拒绝；嵌套结构判定用 `looksLikeLang` 启发式（外层键都像语言代码才按「语言→Key→译文」解析），否则拒绝并定位问题条目，避免字段名充当 key 的脏数据
- CSV 表头**严格匹配**（大小写与写法完全一致、不支持别名）：仅 `key`、`sourceText`、`tags`、`context` 被识别，非空列按语言代码处理、空表头列忽略不产出条目；无 key 列、无表头或 header-only 均报错。导出 CSV 表头为 `key,<语言...>`（不含 sourceText），与导入严格表头对应
- **原文（sourceText）去冗余**：`translation_keys` 无 `source_text` 列，原文统一由源语言语言值（源语言 value 的 `translatedText`）承载。条目导入（`importKeys`）**支持 `sourceText` 或源语言列**，二者等价于源语言的翻译更新（`sourceText` 字段或 `lang === 源语言` 的语言列值 → upsert 源语言 value）；译文导入（`applyTranslations`）**不支持 `sourceText` 的导入**（忽略该字段），且**一律跳过源语言列**（无论是否覆盖——源语言译文即原文）：所有语言列先经「code/alias → 规范 code」映射再比对与写入（alias 归一写真实语言，不落游离 value 行），源语言字段计入 skipped 统计但不进「未配置语言」列表，经 `sourceSkippedFields` 返回、前端成行提示。`createTranslation` / `updateKeyAndSource` / `batchUpsert` 的 `sourceText` 同样写入源语言 value；旧环境升级由 `20260808020000_remove_source_text` 迁移内置回填完成，无需单独脚本
- XML：缺 `<resources>` 根节点、`<string>` 缺 `name`、`<language>` 缺 `code` 均报错并定位索引；译文文本按原样字符串解析（fast-xml-parser 关闭 `parseTagValue` 数值转换），纯数字/科学计数/布尔形态的译文原样导入、前导零不丢失
- **语言 code/alias 约定（导入与导出）**：数据存储层永远使用 languageCode；导出由模板配置 `useCodeKey` 决定键名用 code 还是别名优先；导入兼容含别名的数据——code/alias 映射仅用于识别归一，绝不按 alias 落库
- 译文导入（`applyTranslations`）遇**项目未配置的语言代码**（`languageCode` 参数或数据内语言，兼容 `alias`）不拒绝、不自动建语言，而是**在写入遍历中以流式内联预过滤整条丢弃并累计 `skippedLanguages`** 返回，前端 ImportTemplateView 成功提示中列出；统计口径上该条仍计入 `importedKeys`/`importedFields`（由 `parseImportData` 按全量计算）与 `skippedFields`/`skippedKeys`（均为按被跳过的数据条目逐条累加，二者口径一致），与「逐条 skip」口径一致。**仅含未配置语言的 key 不会被创建**（不落空 key 行），只有至少含一个项目语言的 key 才会建行并写入已知语言译文；`importKeys` 无语言属性，恒返回 `skippedLanguages: []`
- 返回统计为**双维度**（所有格式通用）：`importedKeys`（去重键数）/`importedFields`（含多语言展开的条目总数），`createdFields`/`skippedFields` 为字段（翻译值）维度、`createdKeys`/`skippedKeys` 为去重键维度（keys 用 Set 去重），两者各自独立。前端成功提示按导入类型取主计数与维度：导入条目（entries）用 `importedKeys` 显示「个条目」、跳过/新增用键维度 `skippedKeys`/`createdKeys`；导入译文（translations）用 `importedFields` 显示「个字段」、跳过/新增用字段维度 `skippedFields`/`createdFields`

### 导入并发控制与进度

- **同项目互斥锁**：`backend/src/lib/import-lock.ts` 进程内 `Map<projectId, ImportControl>`（单实例 Docker 部署），`tryAcquireImportLock` / `releaseImportLock` / `getImportLock` / `abortImport`。导入进行中再导入返回 `Conflict(1004)`；跨项目并发不受限。
- **后台异步执行**：`importEntries` / `importTranslations` 仅做鉴权 + 抢锁，随即通过 `runImportInBackground` 把真正的解析/写入放到后台 Promise 执行，**接口立即返回 `{ accepted: true }`**（不再阻塞等待整次导入完成）。`ImportControl` 在导入结束后置 `done=true` 并保留结果（不删除，下次导入会覆盖），故即便请求已返回，仍可通过 `GET /imports/status` 持续读到进度，结束后还能读到最终 `result`（或 `error`）。
- **写入性能优化**：`ImportsController` 的 `importKeys` / `applyTranslations` 写入阶段（每批 `IMPORT_BATCH=1000`）已全部走原生批量/参数化 SQL，不再有逐条事务——A. 译文/原文值用 `bulkWriteTranslationValues` 单条 `INSERT ... ON CONFLICT (key_id, language_code) DO UPDATE`（`$executeRaw`+`Prisma.join`/`Prisma.sql`，参数化防注入，同 `(keyId,lang)` 经 Map 去重即优化 E）批量 upsert，替代逐条 `translationValue.update`；B. Key 的 `context`/`tags` 用 `bulkUpdateKeyMeta` 单条 `UPDATE ... FROM (VALUES ...)` 一次完成（tags 为 `string[]`，参数化 + `::text[]` 交由驱动转义，无注入风险）；C. B 与 A 合并进同一个 `$transaction` 提交，减少一次往返；D. 新建 Key 用 `createManyAndReturn` 直接拿回 `{id,key}`，省去此前 `createMany` 后的 `findMany` 回查；E. `toWrite` 同 `(keyId,lang)` 经 Map 去重取末值；F. `applyTranslations` 的值预载由 `keyId IN ∧ lang IN` 改为 `(key_id, language_code) 元组 IN` 精确匹配（参数化），避免笛卡尔积回查；G.（V8 OOM 防线）`applyTranslations` 的未配置语言预过滤与分批写入为**单次流式遍历**，无 `filteredEntries` 全量中间数组——38MB 级多语言 CSV 展开的百万条目若物化全量数组会直接 OOM；H.（V8 OOM 防线）跨批 `keyIdCache` 设 `IMPORT_KEY_CACHE_MAX=50000` 上限，`flush` 开头超限整体清空、由后续批次重新查库（unique `(project_id, key)` 命中索引），防百万级 key 时 Map 无界膨胀；I. 五种格式解析均为惰性 `Iterable<ImportEntry>`（可重复迭代，供「校验遍历 → 写入遍历」两轮消费）：CSV/Properties 逐行状态机直接产出（无全量行数组/条目数组）；JSON/YAML/XML 结构判定依赖完整顶层键集（`JSON.parse` / js-yaml `load` / fast-xml-parser 的对象树整体在内存），由生成器遍历既有树逐条产出、不物化条目数组。导入全程内存驻留仅剩 raw 文本（38MB≈76MB UTF-16）+ 去重键统计 Set + 单批缓冲。SSE 推送（`getImportStatusStream`）导入进行中按 250ms 节流（解锁/结束态恒推），且节流判断前置到 `buildImportStatusRow` 之前，省去被节流时的建行 + JSON 序列化开销。改动写入逻辑时勿退回逐条事务。
- **进度 `ImportProgress`**（8 字段，按阶段分组）：解析阶段 `parsedFields`（已解析字段数）/`parsedKeys`（去重键数）；写入阶段 `totalFields`/`totalFields`→`createdFields`/`skippedFields`（字段维度）+ `totalKeys`/`createdKeys`/`skippedKeys`（去重键维度）；`phase` 为 `parsing`/`writing`/`done`。`parseImportData` 每解析 1000 条 `deferEventLoop()` 让出事件循环，避免大文件阻塞。
- **状态查询** `GET /imports/status` 返回 `ImportStatusRow`：`locked`/`type`/`startUserId`/`startUsername`/`startTimestamp`/`progress`（含以上 8 字段）/ `result`（导入结束后的 `ImportResult`，否则 null）/ `error`（导入失败的错误信息，否则 null）。前端导入页据此驱动 UI。
- **中止** `POST /imports/abort`：`ImportControl.aborted = true`，运行中的导入在**解析阶段（`parseImportData` 每 1000 条让出事件循环处）与每个写入批次（`flush` 开头）均会检查该标志**，命中即抛 `Conflict` 中止，控制对象置 `done` 并保留 `error: '导入已中止'`；仅**发起人或 super_admin** 可中止（其余返回 `Forbidden(1002)`，无进行中导入返回 `Conflict(1004)`）。
- **前端导入页行为**（`ImportTemplateView.vue`）：导入状态以**最近一次 status 轮询为准**（本地 `importing` 仅用于「开始导入」按钮 spinner）；轮询间隔「导入中 2 秒 / 空闲 30 秒」，提交后立刻再拉一次 status。POST 仅返回 `accepted`，**真正的成功/失败提示在 status 轮询带回 `result`/`error` 时弹出**（按 `startTimestamp` 去重避免重复；页面加载/刷新后直接读到已完成状态同样展示可关闭的结果提示——本会话发起的标题「导入完成：」（零写入时降级 warning 标题「导入完成：未写入任何译文」），否则「已导入：」）；导入中（status `locked`）用页内 `BaseNotice` 展示进度，并**禁用所有业务控件**（选择文件/开始导入/格式/语言/勾选/文本框），但「模式（导入条目/导入翻译）」「输入方式（文件/文本）」两个 radio-group 仍可切换；若当前用户是发起人（`startUserId === 当前用户`），alert 内显示「中止导入」按钮（跨标签页也有效）；中止时 `doAbort` 在收到服务端确认后**立即**弹出「导入已中止」提示（不再依赖轮询/SSE 最终态回带），避免中止后进度横幅消失而无提示。译文导入目标语言下拉排除源语言、默认选首个非源语言项；语言行在翻译模式**常驻**——仅 CSV（语言=列名，唯一无需指定）以下拉位显示灰字说明；翻译模式下表单下方常驻统一提示行——按输入方式拼接支持范围（文件模式注明 Properties 仅文本输入）与「嵌套结构按文件内语言解析，扁平与 Properties 使用所选目标语言」；已选文件名旁有 danger 色「移除」文本链接（BaseLink，与文本模式「清空」同款式）可移除已选文件，并有常驻提示集中说明语言来源（CSV 列/嵌套按文件内、扁平用所选）、兼容代码别名、未配置语言跳过、源语言即原文列需走导入条目；条目模式有对称的「导入条目说明」（字段约定/新增内容/覆盖勾选语义/代码别名/译文不改动）；页面满高 flex 布局：内容区不滚动，上方操作区 + 下方 A 区（左「导入说明」、右「格式说明」卡片）占满剩余高度；文本输入经表单内「填写内容」（默认灰）按钮打开 720px 草稿式弹窗编辑 textarea（打开时从 textInput 同步草稿、确定写回、取消丢弃；textarea 右下亦显示文本长度），已填内容于表单下方提示「文本长度：N」+「清空」按钮（与文件模式对称），A 区不承载输入框；说明卡片内容为 HTML 片段（ul/li 列表 + 行内 code），经 main.ts 注册的 vue-dompurify-html 插件以 v-dompurify-html 指令净化渲染；`wasImporting` 仅在 POST accepted 后置位（提交失败不错认领历史结果）。
- **导入锁（共享 composable + SSE）**：`frontend/src/hooks/useImportStatus.ts` **优先通过 SSE**（`GET /projects/{slug}/imports/status/stream`，fetch 携带 `Authorization` 头读取流，浏览器 `EventSource` 无法自定义头故用 fetch）实时订阅状态变更；`isLocked` 为**远程锁 ∥ 本地提交锁**（options.importing：点击导入立即生效，远程 locked 确认后交接、5s 超时兜底）；**连接失败/断开时自动回退**到轮询（含服务端正常关闭——后端重启/代理断开，流 `done` 结束同样回退，否则页面会永久失聪） `GET /projects/{slug}/imports/status`（频率随锁状态切换：进行中 2 秒 / 空闲 30 秒）。后端 `backend/src/lib/import-lock.ts` 以 `EventEmitter` 广播（`emitImportStatus(projectId)` / `subscribeImportStatus`），在 `parseImportData` 每 1000 条、`flush` 每批、`runImportInBackground` 起止处触发；`ImportsController.getImportStatusStream` 订阅后向客户端推送最新 `ImportStatusRow`（连接即推当前快照，`: ping` 保活）。向所有受导入影响的页面暴露 `isLocked`（是否锁定）/ `importerName`/`importerId`（发起人，决定「中止导入」按钮可见性）/ `bannerTitle`（翻译/语言管理页锁定横幅）/ `importTitle` + `statsLines`（导入模板页进行中提示标题与明细）/ `status`（原始 `ImportStatusRow`，含 `result`/`error` 供成功/失败提示）等响应式状态；`statusLine` 按阶段给出进度文案「写入中（X%）」/`解析中`/`写入完成`，`statsLines` 给出明细多行——解析阶段「解析：X 条 / Y 个字段」；写入/完成阶段按模式分行（导入译文显示「字段：总 X 个，新增 Y 个，跳过 Z 个」+「条目：总 X 条，新增 Y 条，跳过 Z 条」，导入条目仅显示条目行）。`status` 接口对任意项目成员开放（仅 `@Security('auth')` + `assertProjectAccess`），锁状态对**所有角色、跨标签页**实时生效，防止页面编辑与后台导入并发写入冲突。
- **翻译管理页导入锁**（`TranslationListView.vue`）：导入进行中，**翻译管理整页不可写**——复用 `useImportStatus`，`isLocked` 为真时顶部展示 `BaseNotice` 警告条并禁用所有写操作（新增/删除 Key、编辑 Key/原文/译文/标签/备注、拖拽排序、跨屏插入），可编辑列回退为只读渲染（`translationColumns` 内 `void importLocked.value` 显式建依赖）。导入结束（`isLocked` 变 false）后 2 秒内自动解锁恢复编辑。
- **语言管理页导入锁**（`LanguageManageView.vue`）：语言与导入强相关（导入条目/译文依赖项目语言集），导入进行中同样**锁定**——复用 `useImportStatus`，`isLocked` 为真时顶部展示 `BaseNotice` 警告条，并禁用所有写操作（添加/删除语言、设为源语言、编辑别名、上下排序），别名输入框转为只读。导入结束后自动恢复。
- **编辑页导入锁**（`ProjectCreateView.vue`，路由 `/projects/:slug/edit` 复用创建页 isEdit 模式）：锁定时展示警告条并禁用整个表单与删除按钮（handleDelete/handleSubmit 有守卫）；提交中 loading 同样锁定全表单；新建模式无项目不涉及。
- **首页项目卡片锁提示**（`DashboardView.vue`）：10s 轻量轮询各项目 imports/status（不建 SSE），导入中卡片显示「导入中」徽标并禁用编辑/删除图标，删除另有消息守卫。
- **提示文案双维度**：进度解析阶段显示「X 条目 / Y 字段」（keys→条目，fields→字段）；写入阶段条目模式用 keys 计数、翻译模式用 fields 计数。成功提示导入条目用 `importedKeys`（个条目）、导入译文用 `importedFields`（个字段）。


### 翻译页面关键逻辑

- 后端 `listGrouped` 按 key 聚合，返回 `translationKey + sourceText（= 源语言 value）+ context + tags + translations{}`；原文列弹窗编辑保存即更新源语言 value
- 弹窗编辑保存后通过 `saveTranslation` / `updateKey` API 更新，并同步到本地 rows（无 transCache 行内缓存）
- context 和 tags 是 key 级属性，不按语言缓存
- **列表渲染**：`TranslationListView.vue` 一次加载全量（`pageSize: -1`，后端 `TranslationsController` 对 -1 用 `1e9`），用 **el-table-v2 虚拟滚动**（`ElAutoResizer` 包裹测尺寸 + **`BaseTableVirtualized`** 封装，固定行高 `rowHeightMult`×20+4+20 存 localStorage `trans-row-height`；斑马纹 `stripe` 开启，滚动时 `:stripe="!scrolling"` 动态禁用）渲染。el-table-v2 行是 `position:absolute` 虚拟渲染，行内 textarea autosize 会破坏固定行高，故所有编辑用**弹窗编辑**（单元格截断文本 + Edit 图标 → `expandDialog` 720px BaseDialog，Key/原文/译文/标签/备注均可编辑，原文框 `max-height:420px; overflow:auto`）。**滚动降级机制（静态 div 方案）**：滚动时（`onTableScroll` 置 `scrolling=true`，停止 600ms 后重置）所有可编辑列切换为**纯静态 div**，不挂任何可交互组件（消除 ResizeObserver/slotchange/selectionchange 事件风暴，主线程在滚动中几乎空闲）——Key/原文/译文/备注用 `StaticTextCell`（`base-textarea cell-static-text` 类，白底 + inset 描边 + 8px 圆角 + `padding:2px 6px` + `line-height:20px`，多行文本逐行 span 渲染，外观对齐 BaseInput textarea）；语言列 `.cell-static-lang`（inset 描边圆角，显示当前选中语言别名）；标签列 `.base-select cell-tags`（对齐 BaseTagInput `collapseTags` 折叠：首 tag + `+N` tag，两者均为 `.cell-tag` 外观，18px 高 info 配色）；操作列 `.cell-delete-static` 灰色「删除」占位。`translationColumns` computed 内 `void scrolling.value` 显式建立依赖（cellRenderer 闭包内读取 `scrolling.value` 不会触发响应式追踪，必须依赖它才能在停止滚动后重建 columns 恢复交互组件）；行 hover 背景过渡是滚动卡顿主因，`.trans-table.is-scrolling` 时 `user-select:none` + `transition:none`（`.el-table-v2__row` 及 `.is-hovered`）禁用。未启用 `useIsScrolling`（源码实测其 isScrolling 每帧 nextTick 即重置，滚动中恒 false 且造成 cache 1↔8 抖动重渲染，降级完全由手写 debounce 承担）。**textarea 原生滚轮**：el-table-v2 在滚动容器上以冒泡阶段挂 wheel 监听（`build-grid.mjs` 的 `useEventListener(windowRef, "wheel", onWheel, { passive: false })`），`useGridWheel` 对非边缘滚动一律 `e.preventDefault()`，弹窗内 textarea 的多行滚轮会被吞掉；表格容器已加捕获阶段 `@wheel.capture="onWheelCapture"` 拦截——目标是可滚动 textarea（`scrollHeight > clientHeight`）时 `stopPropagation()` 恢复原生滚动，不可滚动时照常冒泡让表格滚动。**标签列**：行内 `BaseTagInput` 开 `collapseTags` 折叠为「+N」防溢出固定行高，Edit 图标打开标签弹窗（`expandDialog` 新增 tags 分支，`BaseTagInput` 全量编辑，保存时去重/trim/过滤空值后走 `PUT .../translations/{keyId}` 并刷新标签候选项）
- 编辑类保存全部走 keyId 定位：译文列 `PUT .../translations/{keyId}/{langCode}`（任意成员，仅传 translatedText），Key/原文/标签/备注走 `PUT .../translations/{keyId}`（Maintainer+）；Key 改名不影响缓存键（keyId 稳定）
- **IME 组合守卫**：行内编辑 blur 保存统一走 `handleBlurSave`——经 BaseInput 透传的 compositionstart/end 维护 `composing` 标志，组合中途失焦不触发本次保存（此时 modelValue 尚为旧值/半截值，el-input 在 compositionend 后才发最终值）；译文列取值兜底为行当前值（`editCache[ck] ?? row.translations[lang]?.translatedText ?? ''`），点击后直接失焦不会把空串当新值清空译文。**Safari 已知问题**：compositionend 晚于 blur 触发的时序下，该次编辑跳过立即落库——内容仍留在输入框与 editCache，下次交互再保存，不丢数据仅延迟
- 仅未翻译：后端过滤 `k.values` 中该语言 `translatedText` 为空或不存在；`#行号`（支持 `#3` 与 `#3-8` 区间）与 `/正则/` 搜索在前端对全量 rows 过滤（`#行号` 时后端不传 search，按全局 rowIndex 匹配）
- 筛选条件（标签 / 搜索 / 仅未翻译）同时启用时以 **AND** 组合，全部满足才显示；多标签之间为 OR（命中任一即通过）
- **行排序机制**：key 级 `sortOrder` 默认从 0 开始，后端 `listGrouped` 按 `sortOrder asc, key asc` 排序，`rowIndex` 为过滤前的全局序号（`#行号` 搜索依赖它保持稳定）。新增 key（普通创建/批量/导入/`import-json.ts` 脚本）均分配 `maxSo + 100` 递增步长，为拖拽折半插入留空位。拖拽用**数据驱动 pointer 实现**（非 Sortablejs，vue-draggable-plus 无法用于 el-table-v2）：pointerdown 记录起点，pointermove 按 `dy/ROW_HEIGHT` 折合目标行、实时 splice 重排 `rows` 并重写 `rowIndex`，配合 `scrollTop/tableHeight` 计算可视行区间做**同屏拖拽 + 禁跨区**；pointerup 保存 `so = Math.round((prevSo + nxtSo) / 2)`，间距耗尽无空位时从相邻最小值开始整页重排（`base + (i+1)*10`）。**跨屏插入排序**：拖动句柄旁的定位图标按钮（无筛选时显示）打开 `insertDialog`（标题「插入到…」），输入目标行号（1 起，对应左侧 `#` 列）+ 之前/之后，`confirmInsert` 在本地 rows 上按同屏拖拽相同的折半逻辑算出目标下标插入，并复用相同的 `sortOrders` PUT 保存；行号超出 `1 ~ rows.length` 弹警告。存量数据由 `20260808030000_backfill_key_sort_order` 迁移重排（按当前顺序 0/100/200...）——**该迁移随部署自动应用，勿手动用 `db:push` 绕过**，否则存量 key 全 0 时排序不生效

**翻译管理页测试要点（keyid 化回归）**

1. **特殊字符 Key**：含 `/`、空格、中文等字符的 Key，改名/原文/标签/备注/译文保存均正常，改名后同行其余列仍可编辑
2. **权限**：member 仅可编辑译文列（Key/原文/标签/备注列不可编辑、无操作列、无拖拽/插入图标）；maintainer/admin 全列可编辑；member 越权调用（改源语言、改非项目语言）后端拒绝并返回中文提示
3. **新增 Key**：对话框无原文输入框，创建后原文列为空，可在原文列弹窗编辑
4. **原文保护**：译文保存不影响源语言原文；源语言不在翻译目标语言中
5. **列表交互**：全局语言切换仅改显示不刷新；「仅未翻译」开启时切换才刷新；虚拟滚动滚动流畅、固定行高无跳动；拖拽只限同屏可视区、禁跨区；滚动时单元格降级为静态 div（滚动中不可编辑、斑马纹/行过渡/文本选择禁用），停止滚动 600ms 后恢复交互组件；行高 4 档（低/默认/高/超高）切换即时生效并持久化（localStorage `trans-row-height`），高/超高档单元格顶对齐、内边距变大
6. **跨屏插入**：仅无筛选时拖动句柄旁显示定位图标 → 弹窗输入目标行号 + 之前/之后；行号越界弹警告；目标=当前行直接关闭；member 无图标；插入后刷新顺序保持
7. **textarea 滚轮**：弹窗内多行 textarea 滚轮只在框内滚动，不被表格吞掉；未超长 textarea 滚轮仍滚动表格
 8. **标签折叠与弹窗**：行内标签 `collapseTags` 折叠为「+N」不溢出行高；Edit 图标打开标签弹窗全量编辑，保存后行内/候选标签刷新；标签列可编辑权限下才有图标
 9. **导入锁**：导入进行中（`GET /imports/status` 的 `locked` 为真）打开翻译管理页，顶部显示警告条，且所有写操作禁用——新增/删除 Key、编辑 Key/原文/译文/标签/备注、拖拽排序、跨屏插入图标均不可见/不可触发，可编辑列回退只读渲染；锁状态对所有角色、跨标签页实时生效（status 接口全员可访问），导入结束后约 2 秒自动解锁

### API Key 鉴权

外部自动化可通过 API Key + Secret 访问白名单内的接口。所有接口 `/api/v1/*` 均可，将路径前缀改为 `/api/v1/apikey/`：

```bash
# 导出翻译
curl -X POST http://localhost:21080/api/v1/apikey/projects/:projectId/exports/generate \
  -H "x-api-key: ak_xxx" \
  -H "x-api-secret: xxx" \
  -H "Content-Type: application/json" \
  -d '{"templateSlug":"...","languageCodes":["zh-Hans"]}'
```

- **白名单**：配置在 `backend/src/lib/apikey-whitelist.ts` 的 `APIKEY_WHITELIST` 数组，每条声明「方法 + 路径正则」；新增开放接口在此追加一条即生效，无需改守卫（`index.ts` 守卫与 `services/docs.ts` 抽取共用）。当前已开放翻译 Key 的**增删改**：`POST .../translations`（新增 Key）、`PUT .../translations/{keyId}`（改 Key 级属性，`(?!sortOrders)` 负向前瞻排除排序接口）、`DELETE .../translations/{translationId}`（删除 Key），均为 Maintainer+
- **OpenAPI 文档**：白名单接口在 Swagger UI 顶部下拉「API Key 开放接口」（`GET /api-docs/apikey.json`，`buildApiKeyOpenApiSpec` 派生）；前端「开放接口说明」页（`/api-doc`）经 JWT 接口 `GET /api/v1/openapi-doc` 同逻辑派生展示（登录可见，不依赖 `/openapi/*` 代理）
- **管理接口**：`GET|POST|PUT|DELETE /api/v1/me/keys`（`ApiKeysController` 为 `@Route('me')`，前端**不要**用 `/apikey/` 前缀调用）；代理上 tsoa 自动镜像的 `/apikey/me/keys` 被 `apiKeyAuth`（缺头 401）与白名单（403）双重拦截，外部 API Key 客户端无法管理

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
| `csv` | `.csv` | 多 | 表格，key / 各语言各一列 |

### 导出模板 config 字段

```json
{ "skipIdentical": true, "skipEmpty": true, "useCodeKey": false }
```

### 常见问题

1. **Vite 模块找不到** — `rm -rf node_modules/.vite && pnpm dev`
2. **Prisma 文件锁** — `rm -rf node_modules/.prisma && pnpm prisma generate`
3. **`psql` 中文乱码** — 用 `pnpm tsx -e "import{PrismaClient}..."` 查数据
4. **路由冲突** — `/:keyId` 会吃掉 `/sortOrders`、`/batch`，tsoa 按方法声明顺序注册路由，必须把 literal 路由（`sortOrders`、`batch`、`count`）声明在参数路由（`{keyId}`、`{keyId}/{langCode}`）前面
5. **含 `/` 的 Key 保存报 `Key not found`** — UAT 前置 nginx 的 `merge_slashes` 会把 `%2F` 解码成字面 `/` 并合并斜杠导致 key 失真。编辑类操作已全面改用 **keyId 定位**（UUID 纯 unreserved 字符，天然免疫），列表查询路径无此问题；排查时若发现某 path 参数被 nginx 改写，确认前后端都走 `encPathParam`/`decPathParam`，禁止百分号编码
6. **`cannot edit` 报错** — GateGuard hook，用 `ECC_GATEGUARD=off` 前缀或加到 `settings.json`
7. **前端 TS 报错（`Property 'xxx' does not exist on type`）** — 改 schema 后未同步 `frontend/src/types/models.d.ts`，检查并添加对应字段

### Base UI 组件体系

前端基础 UI 元素封装在 `src/components/ui/`，通过 `@/components/ui` barrel（命名导出）统一导入。每个组件目录含 `index.vue` + `style.scss`（组件自定义样式，**可改**），修正 Element Plus 默认间距的组件另有 `reset.scss`（EP 样式重置，**不可改**），方便后续全局扩展和换肤。

**封装目的**：统一样式入口，便于**换皮肤和全局扩展**（换肤 = 替换 style.scss 即可全局生效；扩展 = 在 base 组件上统一加行为/样式），**不是为了减少使用量**。不要因"用的少"就拒绝封装，凡是出现在页面中的 Element Plus 基础组件都应走 Base 封装。

**样式分离约定**：每个组件的样式分为两部分——
- `reset.scss`（**不可修改**）：Element Plus 样式重置，仅放修正 EP 默认 margin/padding 在布局中产生大空白的规则（如 `.el-form-item` 边距、`.el-dialog` 各区块内边距）。EP 新发现的间距问题一律加到这里。
- `style.scss`（**可修改**）：组件自定义外观（圆角/颜色/阴影/过渡/布局等）。调样式只允许改这里。
- 无需重置间距的组件只有 `style.scss`，不建 `reset.scss`。

**核心规则：**
- 显式 `defineProps` + `withDefaults` + `defineModel` + `defineEmits`，不使用 `v-bind="$attrs"`
- 样式通过 `<style lang="scss" scoped>@use './reset.scss'; @use './style.scss';</style>` 加载（无需重置的组件只 `@use './style.scss'`），scoped 隔离 + 外部文件可替换（用 `@use` 而非 `@import`，Dart Sass 已弃用后者）
- **子组件内部元素必须用 `:deep()`**：scoped 样式只能命中组件根元素，`.base-xxx .el-input__wrapper` 这类选择器命中不了 el-input 内部 DOM（否则是死样式，圆角/阴影不会生效）。统一格式 `:deep(.el-xxx)`，外层前缀（`.base-xxx`）保持带 scope
- **封装后必须迁移现有使用处**：将页面中已存在的 `<el-xxx>` 替换为对应 Base 组件，避免新旧混用
- **封装后必须更新本列表**：新增组件要同步补充到下方「当前组件」表格（含类型和说明），并导出到 `ui/index.ts` barrel
- **defineExpose 组件的父组件 ref 类型**：用 `useTemplateRef<ComponentExposed<typeof Child>>('xx')`（`import type { ComponentExposed } from 'vue-component-type-helpers'`），不能用 `InstanceType<typeof Child>`——后者是组件实例类型，提取不到 `defineExpose` 暴露的方法（如 BaseForm 的 validate 等）

**当前组件：**

| 组件 | 类型 | 说明 |
|------|:----:|------|
| BaseButton | 透传 | Element Plus el-button 封装 |
| BaseCheckbox | 透传 | el-checkbox，defineModel 双向绑定 + label slot |
| BaseContextMenu | **配置式** | 右键菜单容器：`items: ContextMenuItem[]`（`key`/`label`/`danger`/`disabled`/`divided`/`render?: () => VNode`（TSX 渲染）/`onClick`）驱动，`v-model:visible` 显隐 + `x`/`y` 定位；自动视口收拢、外部点击/滚轮/Esc 关闭（点击菜单内部不关闭，disabled 项不触发），点击项 emit `select(key)`；颜色/背景用 Element Plus CSS 变量实现换肤 |
| BaseDataViewer | **配置式** | 基于 `data-visor-vue` 的通用数据查看器，lang 支持 json/yaml/xml，Shiki 高亮，含树形/源码（Minified）/分块（Fractured）模式，`showFractured` 默认 false（隐藏 Fractured 按钮，需要时传 true）；内容统一等宽字体（组件内定义 `--font-mono` 变量并 `deep()` 覆写全部子元素；data-visor 自身未强制等宽）。不做尺寸分档：DataVisor 内部字号为固定 px/rem（rem 相对页面根元素、`.dv-viewer` 自身写死 13px，不随容器 font-size 缩放），且树形虚拟列表行高在 JS 中写死 24px，如需分档须逐区域 deep 覆写（成本高已放弃）。该依赖有 pnpm patch（`frontend/patches/data-visor-vue@0.0.4.patch`），累计 5 处：① YAML Minified 模式保留原文本（原实现误转 JSON）；② XML 树形模式扁平化重复兄弟标签数组，避免 `<tag>` 显示两层；③ 扁平化后 item 深度对齐父级，避免展开父节点后子行不显示；④ XML 属性子行排到子元素之前（默认被解析器放在对象末尾）；⑤ 新增 `showFractured` prop（DataVisor + Toolbar + d.ts），控制 Fractured 模式按钮显隐（默认 true） |
| BaseDialog | 透传 | el-dialog，defineModel 双向绑定 |
| BaseForm | 透传 | el-form，卡片式容器；内部 el-form 实例方法（validate/validateField/resetFields/clearValidate）经 defineExpose 暴露，父组件 `ref` 可直接调用 |
| BaseFormItem | 透传 | el-form-item |
| BaseIcon | 透传 | el-icon，hover 动画 |
| BaseInput | 透传 | el-input，支持 autosize；透传 compositionstart/compositionend（IME 组合守卫用） |
| BaseLink | 透传 | el-link，文本链接（表格操作列用）：`type`（默认 `'default'` 灰色，与原生一致）/`size`/`underline`（默认 true）/`disabled`/`href`/`icon`，点击 emit `click`；无按钮阴影，操作列默认 `:underline="false"` 保持 link-button 视觉；样式：font-size 13px，相邻 margin-left 12px |
| BaseNotice | 透传 | el-alert 提示条封装：`type`（默认 `'info'`）/`title`（留空可用 `#title` 插槽）/`closable`（默认 true，关闭 emit `close`）/`showIcon`（默认 true，26px 大图标统一视觉）/`lines: string[]`（多行说明逐行渲染，导入统计等场景用），默认插槽可追加内容（如导入进行中横幅内的「中止导入」按钮）；含 `reset.scss`（EP 图标/标题样式修正） |
| BasePageHeader | 透传 | 页面标题栏 |
| BaseRadioGroup | **配置式** | el-radio-group，options 驱动，泛型值，支持 button 模式 |
| BaseJsonSchemaViewer | 透传 | 基于 `cf-json-schema-viz`（React）经 `veaury` `applyPureReactInVue` 桥接的 JSON Schema 树形查看器；`schema` 必传，支持 `defaultExpandedDepth`/`expanded`（默认全展开）/`disableCrumbs`/`renderRootTreeLines`/`emptyText`；容器高度经 ResizeObserver 测量后透传 `max-height`；样式变量映射到 Element Plus CSS 变量实现换肤。依赖 react/react-dom/veaury/cf-json-schema-viz，已在 `vite.config.mts` `optimizeDeps.include` 预构建。注意：`@stoplight/json-schema-tree` 只相对传入的根 schema 解析 `$ref`，传入孤立 schema 时嵌套引用无法展开，调用方需先用 `dereferenceSchema` 深解引用 |
| BaseTable | **配置式** | columns 配置驱动，cell 使用 TSX 渲染 |
| BaseTableVirtualized | 透传 | 基于 el-table-v2 的虚拟滚动表格（大列表/翻译管理页用）：`<T extends object>`，透传 ElTableV2 核心能力（`columns`/`data`/`width`/`height`/`rowHeight`/`headerHeight`/`rowKey`/`fixed`/`rowClass`/`cache`/`scrollbarAlwaysOn`/`useIsScrolling`/`stripe`/`loading`），`verticalScrollbarSize`/`horizontalScrollbarSize` 经 `v-bind` 透传 `v-scrollbar-size`/`h-scrollbar-size`（eslint 禁 `:v-*` 直接绑定）；事件 `scroll`/`rowsRendered`/`endReached`，插槽 `#empty` + 默认（#footer）。注意：固定列模式下 el-table-v2 渲染 main/left/right 三张虚拟列表，滚动优化优先考虑减少 columns 重建 |
| BaseSelect | **配置式** | options 配置驱动，泛型选择器 |
| BaseTabs | **配置式** | tabs 配置驱动，泛型 tab key，内容通过 `#tab-{key}` 具名插槽 |
| BaseTabButton | 透传 | 标签页按钮（AppTabs 用）：`label`/`active`/`closable` props，点击 emit `click`，关闭图标常显（closable 时）点击 emit `close`；激活态主色实心，关闭图标 hover 变红 |
| BaseTabularViewer | **配置式** | 通用类表格文本查看器（CSV/Properties 等），`format` prop 决定表格解析方式（`csv` RFC 4180、`properties` 按 `=`/`:` 拆键值对并跳过 `#`/`!` 注释行，列头固定为 键/值）；顶部工具栏（BaseRadioGroup button 模式）切换 表格/原文 视图，含「自动换行」开关（BaseCheckbox，`v-model:wrap`）和「复制」按钮（navigator.clipboard，带 CopyDocument 图标）；视图模式 `v-model:mode`；支持 `v-model:size` 三档布局尺寸（small/default/large，默认中），尺寸同时作用于工具栏切换标签/自动换行/复制按钮、表格单元格疏密与原文视图字号——正文字号三档为 12/14/16px（默认档对齐 el-table 全局 14px），表头比正文大 1px（13/15/17px，深底白字更醒目）；深色 sticky 表头 + 斑马纹 + 列间竖线（`showGridLines`），外层统一边框白底，与 BaseTable 样式区分 |
| BaseTag | 透传 | el-tag 标签：`type`/`size`/`effect`/`round`/`closable`/`disableTransitions`，可点击，`closable` 时 emit `close`（状态/源语言等只读标签用） |
| BaseTagInput | **配置式** | 标签输入器：基于 BaseSelect 封装（`multiple`+`filterable`+`allow-create`+`default-first-option`），`options: string[]` 提供已有标签备选（**已选标签仍保留在候选中可搜索、可取消**），输入新标签可创建；**支持逗号/分号（中英文）、回车、Tab 作为新增标签的确认键**（回车由 el-select allow-create 原生完成，逗号/分号/Tab 由组件在 `keydown` 中拦截：补入 `v-model` 并清空输入框）；`v-model: string[]`，值按 key 天然去重；透传 `placeholder`/`size`/`clearable`/`disabled`/`collapseTags`/`reserveKeyword`（默认 true），`change` 事件在值变化时触发。**重名语义**：点击/回车对已选标签为「切换」（会移除该标签），逗号/分号/Tab 为「仅新增」（重名时跳过加入、仅清空输入框）。BaseSelect 已新增 `allowCreate`/`defaultFirstOption`/`reserveKeyword` 透传属性及 `keydown` 透传事件 |

其中 BaseTable、BaseSelect、BaseRadioGroup、BaseTabs 为**配置式封装**，不同于简单透传：

- **BaseTable `<T extends object>`** — 通过 `columns: BaseTableColumnConfig<T>[]` 配置驱动，`cell` 渲染函数使用 TSX（需 `@vitejs/plugin-vue-jsx`，`tsconfig.json` 设 `jsxImportSource: "vue"`），替代 `<el-table-column>` 手写。`BaseTableColumnConfig` 类型定义在 `./types.ts`。
- **BaseSelect `<T, TItem>`** — 通过 `options` / `labelKey` / `valueKey` / `labelGetter` / `valueGetter` 配置选项，替代 `<el-option>` 手写循环。
- **BaseRadioGroup `<T>`** — 通过 `options: BaseRadioOption<T>[]`（`label` / `value` / `disabled`）配置选项，`button` prop 切换 `el-radio-button` / `el-radio` 渲染，泛型值约束为 `string | number | boolean`。

### 前端关键文件

| 文件 | 职责 |
|------|------|
| `stores/auth.ts` | 用户信息、系统角色、`activeProjectSlug`；`activeProjectName` / `projectRole` 为从 project store `bySlug` map 派生的 computed，`setActiveProject(slug)` 只写 slug + localStorage；`init()` 启动**token 主动刷新调度**（scheduleProactiveRefresh）与**权限轮询**（`startPermissionPolling`）：每 30s 刷新 `getMe` + 项目列表（`fetchProjects(true)`），后台标签页跳过、回前台立即补一次，权限变更后 UI 权限 computeds 响应式隐藏/显示操作入口（不重载页面）；`logout()` 同时停止两者 |
| `stores/project.ts` | 用户参与的项目列表 + `bySlug` computed（slug=`code||id` → Project）；`auth.init()` 启动加载（`loaded` 守卫），增删改（`create`/`update`/`remove`）统一走 store 保证 map 一致，`clear()` 供 logout 调用 |
| `stores/translation.ts` | 翻译列表、GroupedRow 类型 |
| `stores/loading.ts` | 全局 loading 遮罩 |
| `stores/tabs.ts` | 顶部标签页（AppTabs）：已打开页面列表、activePath、增删标签（首页标签为固定首项，不在 store 中，不可关闭，右键只显示「关闭右侧/关闭其他」）；`renameProjectSlug` 重写项目 tab 路径（code 变更）、`removeProjectTabs` 关闭某项目全部 tab（删除项目） |
| `hooks/useProjectPermission.ts` | 三层权限模型（菜单/功能/数据权限） |
| `api/client.ts` | Axios 实例、401 自动 refresh token；响应拦截器对 `code !== 0` 的业务错误（HTTP 200）统一 reject 并携带 `response`，让各页面 catch 能拿到 `e.response?.data?.message` |
| `api/tokenRefresh.ts` | **token 刷新单源**：`refreshTokens()` 单飞（并发共享一次请求 + 排队）；**主动刷新**——auth.init 后按 localStorage `token_expires` 在过期前 30s 定时换新（后台标签页定时器节流由响应式 401 兜底），监听 `storage` 事件在其他标签页更新/清除 token 时自动重排；**多标签页旋转竞态守卫**——刷新失败时若本地 refreshToken 已被其他标签页换新，则采用新值视为成功而不登出；彻底失败才清 token 跳登录。access TTL 仅 15min，过期瞬间的单次 401 属正常轮换 |
| `router/index.ts` | 路由守卫、auth.init() 初始化；路由 `meta.isStatic: true` 标记固定标签页（不进 tabs store、不可关闭），AppTabs 通过 `router.resolve(path).meta.isStatic` 判断；`meta.perm` 做 URL 直达拦截（`sys:admin`/`sys:super_admin` 按系统角色、`proj:admin`/`proj:maintainer`/`proj:member` 按 URL 项目角色，`hasRoutePermission` 校验，super_admin 项目级恒放行，无权限重定向 `/`）。新增受限页面需设置 `meta.perm` |

### 改动翻译相关功能

1. 先改 `services/translation.ts` → 再改 `controllers/TranslationsController.ts` → `cd backend && pnpm gen` → 最后改前端
2. 改 `prisma/schema.prisma` → `pnpm db:migrate` 生成迁移文件 → 更新 service。必须创建迁移文件（不要用 `db:push` 绕过），否则 Docker 部署时 `migrate deploy` 会遗漏变更
   - 注意：`db:push` 后的 DB 没有 `_prisma_migrations` 记录，直接用 `migrate deploy` 会因列已存在报错，需先用 `migrate resolve --applied` 手动标记已存在的迁移
   - 字段改名类变更：Prisma 自动 diff 会生成 DROP+ADD（丢数据、等于重建列），必须手写迁移 SQL 为 `RENAME COLUMN`（范例 `20260824000000_rename_project_language_code_alias`），schema 用 `@map("新列名")` 对齐后再 `migrate deploy`
3. 翻译列表分页在 `listGrouped` 中处理，导出不过滤在 `getForExport`

### 改 Prisma Schema 后必须做的事

1. 生成迁移文件：`cd backend && pnpm db:migrate`（绝对不能用 `db:push` 代替）
2. 同步 `frontend/src/types/models.d.ts` — 新增或改动的字段必须加上，否则前端 TypeScript 编译报错
3. **重新生成 Prisma Client 并重启后端 dev**（`pnpm db:generate` + 重启 `pnpm dev`；predev 只跑 tsoa gen 不含它）。漏做会出现 P2022「column does not exist」：运行中的进程仍用旧映射列名的 Client 查询已被迁移改名/新增的物理列——报错里的列名是**旧 Client 想查的列**，不是库里缺的列，排查时先 `prisma migrate status` 确认库端状态再定方向

### 改动代码后必须做的事

- 修改代码后同步更新本文档（CLAUDE.md）和 README.md
- 改 Prisma schema 后必须创建迁移文件（`pnpm db:migrate`），不能用 `db:push` 代替

### 语言管理

- 基础语言列表由**后端写死常量**提供（`backend/src/data/languages.ts` 的 `BASE_LANGUAGES`），经 `GET /languages`、`GET /languages/search` 接口（需 auth）下发，前端 `stores/language.ts` 的 `fetchBaseLanguages()` 加载（带 loaded 守卫）；后端 `addProjectLanguage` 严格校验 languageCode 必须存在于该列表，不存在的 code 拒绝添加
- 项目语言支持 `codeAlias` 代码别名（原字段/列名 alias，物理列已由迁移更名 code_alias，请求体/响应/类型均已同步；REST 路径保持 `/languages/:id/alias` 不变）和 `sortOrder` 排序，导出时别名优先
- 语言管理页支持拖拽排序（上下箭头），排序值通过 `PUT /languages/:code/sortOrder` 保存（`:code` 实为 project_languages 行 id，服务端按 id + projectId 校验归属）。新增语言 sortOrder 取 max+100 追加末尾；前端每次移动后按显示顺序**全量重编号 index×10 并仅保存变化的行**——历史数据曾默认 0 并列（并列时列表按 languageCode 兜底排序），只交换相邻两值会制造新并列导致刷新后顺序回退，全量重编号可自愈存量并列；存量并列另由 `20260823000000_normalize_language_sort_order` 迁移按当前显示序固化（显示顺序零变化，随部署自动应用，勿手动用 `db:push` 绕过）

**项目源语言**：源语言必须是项目语言之一，不可删除（`removeProjectLanguage` 对源语言 code 抛错）。三个设置入口共享「自动补语言」语义（`ensureProjectLanguage`：**先校验 code 必须在 BASE_LANGUAGES**，不在项目语言中则自动添加并置顶 min-100 避免并列）：
- 创建项目：源语言**必填**（CreateProjectBody tsoa required + 服务层不再回退 'en'），事务内同时创建源语言的项目语言记录（sortOrder 0 置顶）
- 编辑项目：`updateProject` **无条件**确保最终源语言（传入值或现值）存在语言条目，缺失即补建置顶——不限于「源语言变更时」，保存一次即自愈存量「有源语言设置但语言管理缺该条目」的脏数据
- 语言管理页「设为源语言」：`PUT /projects/:projectSlug/sourceLanguage`（Maintainer+），保存后前端 `loadLangs()` 刷新语言列表并更新 project store

前端约定：语言管理页语言代码列显示源语言 tag、删除按钮禁用；翻译管理页 `editableLangs`（`projectLanguages` 排除源语言）驱动全局语言下拉与行内语言列，源语言不出现在翻译目标语言中。项目创建/编辑页源语言下拉基于 `BASE_LANGUAGES` 全量可选（样式同「新增语言」下拉：左名字右代码），创建/编辑提示源语言会自动添加为项目语言。

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

## 交互约定
- AI 回答应保持精简，用中文回答。
- 遇到不确定的问题先提问；对规划类任务，先给出规划，再收到指令后才落实执行。

