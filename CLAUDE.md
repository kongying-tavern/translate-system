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
│ source_text      │       │ translated_text  │
│ context          │       │ is_reviewed      │
│ tags (TEXT[])    │       │ created_at       │
│ created_at       │       └──────────────────┘
└──────────────────┘

context 和 tags 为 Key 级别属性，跨语言共享
project_languages (alias 别名字段) — 导出和 UI 优先显示别名
```

### 后端分层（tsoa 注解式路由）

```
controllers/ → services/ → Prisma Client
authentication.ts          — tsoa expressAuthentication：@Security('auth'/'admin')，解析 JWT 或复用 apiKey 预置身份，回写 req.userId/userRole
lib/access.ts              — assertProjectAccess(userId, userRole, slug, minProjectRole?) / assertSystemRole(role, minRole)
lib/api.ts                 — ok<T>() / okPage<T>() 统一响应包装 { code, message, data }
lib/prisma.ts              — PrismaClient 单例（独立文件，避免 tsoa 扫描循环依赖）
docs/swagger.ts          — 手写包装（import swagger.json + 加 basePath），必须提交
docs/routes.ts + swagger.json — tsoa 生成产物（`pnpm gen` 重新生成，勿手改），已 gitignore（`backend/src/docs/*` + `!swagger.ts`），由 `predev`（开发启动）和 Dockerfile `RUN pnpm gen`（镜像构建）自动生成
middleware/auth.ts         — AuthRequest 类型 + authMiddleware（JWT，docs 路由仍用）
middleware/errorHandler.ts — 适配 AppError（业务错误 200 + code，鉴权失败 401）与 tsoa ValidateError（→ 1000）
```

**tsoa 用法**：控制器用 `@Route` / `@Get|@Post|@Put|@Delete` / `@Path` / `@Query` / `@Body` / `@Security` 注解，改完控制器后必须 `cd backend && pnpm gen` 重新生成 `docs/routes.ts`（挂载用）和 `docs/swagger.json`（OpenAPI）。

**注意**：
- 字面量类型陷阱：`{ deleted: true }` 这类内联字面量会让 tsoa 崩溃（`isEnumMember` TypeError），必须命名接口（如 `DeletedResult`）。
- tsoa 不支持可选路径参数（`{langCode?}`），需拆成两条路由：`PUT .../{key}`（key 级属性）与 `PUT .../{key}/{langCode}`（语言级）。
- 路由注册顺序 = 方法声明顺序，literal 路由（`key/:oldKey`、`sortOrders`、`batch`）必须声明在参数路由（`{key}`、`{key}/{langCode}`）之前，否则被吃掉。
- 响应类型用 `Date`（tsoa 序列化为 ISO），`description` 等可空字段用 `string | null`；Prisma 返回行与自定义 Row 接口不一致时用 `as unknown as` 转换。
- OpenAPI 字段描述来源：接口/模型属性上方的 `/** 中文说明 */` JSDoc 会映射到 schema 的 `description`；tsoa 无法穿透 Prisma 生成的 client 类型，直接暴露的 Prisma 模型（如 `ProjectLanguage`）应改为控制器内自定义 Row 接口（如 `ProjectLanguageRow`）并加 JSDoc，服务层返回的 Prisma 行结构兼容可直接断言赋值。
- Path/Query 参数描述来自方法 JSDoc 的 `@param 参数名 中文描述`（`@Body` 用 `@param body` 会成为 requestBody 描述）；`@Request() req` 用 `@param req`。ESLint jsdoc 规则要求 `@param` 覆盖方法全部参数（req → path/query → body）且多行块 `/**` 独占一行，`@summary` 保持最后一个标签，否则 `pnpm lint` 报 warning。
- 路由拆分后前端调用 `saveTranslation(projectId, key, '', { context })` 会产生尾部斜杠 `/key/`，Express 非严格模式会匹配 `/{key}` 路由。

### 前端分层

```
views/ → stores/ → api/ → Express (/api/v1/*)
components/common/ — AppHeader(项目切换+设置), AppSidebar(菜单+权限), AppTabs(顶部标签页, 基于 BaseTabButton；首位固定「首页」标签，点击进 DashboardView；右键菜单只显示可执行操作——首页无「关闭自身/关闭左侧」、最左侧/最右侧标签无对应关闭项、标签≤1 无「关闭其他」，不可操作用隐藏而非禁用)
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

**Slug 编码**：`code` 允许含 `/`、空格等字符。前端所有把 slug 拼进 API 路径或路由路径的地方必须用 `utils/slug.ts` 的 `encSlug()`（`encodeURIComponent`）编码为单段，如 `/projects/${encSlug(slug)}/translations`。后端 Express 与 vue-router 会自动解码 `%2F` 参数（`route.params.projectSlug` 拿到的是解码后的原始 code）。从路径字符串手动拆 slug 时用 `decSlug()` 解码（如 AppTabs 用 `t.path.split('/')[2]` 比较 `auth.activeProjectSlug`）。tabs store 的 `isProjectPath`/`renameProjectSlug` 内部已按编码后路径比较/替换。

### API 路由

所有接口 `/api/v1/*`，统一响应 `{ code: 0, message, data }`。路由由 tsoa 从 `controllers/` 生成（`pnpm gen` 更新 `docs/routes.ts`）。

**API 文档**：`/api-docs` 为开发者 OpenAPI 文档（Swagger UI），`index.ts` 用 `swaggerUi.setup(null, { swaggerOptions: { urls: [...] } })` 挂两个文档，顶部下拉切换：

- `./swagger.json` — **JWT 接口**，静态全量，不做角色过滤
- `./apikey.json` — **API Key 开放接口**，`services/docs.ts` 的 `buildApiKeyOpenApiSpec` 从 swagger.json 派生：白名单路径加 `/apikey` 前缀、operation 改用 `x-api-key`/`x-api-secret` 安全方案；相对 URL 被前端 `/openapi/swagger-ui/` 前缀代理命中

原始 OpenAPI JSON 暴露在 `GET /api-docs/swagger.json` 与 `GET /api-docs/apikey.json`（`index.ts` 中显式路由，须注册在 `swaggerUi.serve` 之前，否则被其 SPA 回退吞掉）。前端「开放接口说明」页（`/api-doc`，ApiDocView）调 `GET /api/v1/docs/openapi`（`routes/docs.ts`，JWT 鉴权）展示 API Key 白名单开放接口（完整 `/api/v1/apikey/...` 路径），并按登录用户**系统角色**过滤可见接口（规则表 `APIKEY_ROLE_RULES`，`services/docs.ts` 的 `getApiKeyOpenApi`）：

- 默认（读接口 + 导出预览/生成）：任意项目成员可用（user 可见）
- 批量导入（业务上需项目 Maintainer+）：admin 及以上可见

新增开放接口需同步补充白名单与角色规则。

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
PUT    /projects/:id/translations/key/:oldKey — 更新 Key/原文（Maintainer+，必须在 /:key/:langCode 之前）
PUT    /projects/:id/translations/sortOrders — 批量排序（Maintainer+）
POST   /projects/:id/translations/batch      — 批量导入（Maintainer+）
PUT    /projects/:id/translations/{key}      — 保存 key 级属性 context/tags（Maintainer+）
PUT    /projects/:id/translations/{key}/{langCode} — 保存译文（任意项目成员）
DELETE /projects/:id/translations/{translationId} — 删除 Key（Maintainer+）
GET    /projects/:id/translations/count|tags/list — 需项目访问
POST   /projects/:id/imports/entries|translations — 批量导入（Maintainer+）
GET|POST|PUT|DELETE /projects/:id/layouts/templates|configs — 布局模板/配置 CRUD（需项目访问）
GET    /projects/:id/languages         — 需项目访问
POST|DELETE /projects/:id/languages    — 增删语言（Maintainer+）
PUT    /projects/:id/languages/:code/alias|sortOrder — 别名/排序（Maintainer+）
GET    /projects/:id/members           — 需项目访问
POST   /projects/:id/members           — 添加成员（Project-Admin）
PUT    /projects/:id/members/:id/role  — 修改成员角色（Project-Admin）
DELETE /projects/:id/members/:id       — 移除成员（Project-Admin）
GET    /projects/:id/exports/templates — 需项目访问
POST|PUT|DELETE /projects/:id/exports/templates — 导出模板增删改（Maintainer+）
POST   /projects/:id/exports/preview|generate — 需项目访问
GET|POST|PUT|DELETE /me/keys           — API Key CRUD（JWT）
GET    /languages|/languages/search    — 基础语言
```

### 翻译页面关键逻辑

- 后端 `listGrouped` 按 key 聚合，返回 `translationKey + sourceText + context + tags + translations{}`
- 译文用 `transCache` (key+lang → text) 缓存
- context 和 tags 是 key 级属性，不按语言缓存
- 仅未翻译：后端过滤 `k.values` 中该语言 `translatedText` 为空或不存在
- 筛选条件（标签 / 搜索 / 仅未翻译）同时启用时以 **AND** 组合，全部满足才显示；多标签之间为 OR（命中任一即通过）

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

- **白名单**：配置在 `backend/src/lib/apikey-whitelist.ts` 的 `APIKEY_WHITELIST` 数组，每条声明「方法 + 路径正则」；新增开放接口在此追加一条即生效，无需改守卫（`index.ts` 守卫与 `services/docs.ts` 抽取共用）
- **OpenAPI 文档**：白名单接口在 Swagger UI 顶部下拉「API Key 开放接口」（`GET /api-docs/apikey.json`，`buildApiKeyOpenApiSpec` 派生），前端「开放接口说明」页（`/api-doc`）同源展示
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
| `csv` | `.csv` | 多 | 表格，key / source / 各语言各一列 |

### 导出模板 config 字段

```json
{ "skipIdentical": true, "skipEmpty": true, "useCodeKey": false }
```

### 常见问题

1. **Vite 模块找不到** — `rm -rf node_modules/.vite && pnpm dev`
2. **Prisma 文件锁** — `rm -rf node_modules/.prisma && pnpm prisma generate`
3. **`psql` 中文乱码** — 用 `pnpm tsx -e "import{PrismaClient}..."` 查数据
4. **路由冲突** — `/:key/:langCode` 会吃掉 `/key/:oldKey`，tsoa 按方法声明顺序注册路由，必须把 literal 路由（`key/:oldKey`、`sortOrders`、`batch`）声明在参数路由前面
5. **`cannot edit` 报错** — GateGuard hook，用 `ECC_GATEGUARD=off` 前缀或加到 `settings.json`
6. **前端 TS 报错（`Property 'xxx' does not exist on type`）** — 改 schema 后未同步 `frontend/src/types/models.d.ts`，检查并添加对应字段

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
| BaseDataViewer | **配置式** | 基于 `data-visor-vue` 的通用数据查看器，lang 支持 json/yaml/xml，Shiki 高亮，含树形/源码（Minified）/分块（Fractured）模式，`showFractured` 默认 false（隐藏 Fractured 按钮，需要时传 true）。该依赖有 pnpm patch（`frontend/patches/data-visor-vue@0.0.4.patch`），累计 5 处：① YAML Minified 模式保留原文本（原实现误转 JSON）；② XML 树形模式扁平化重复兄弟标签数组，避免 `<tag>` 显示两层；③ 扁平化后 item 深度对齐父级，避免展开父节点后子行不显示；④ XML 属性子行排到子元素之前（默认被解析器放在对象末尾）；⑤ 新增 `showFractured` prop（DataVisor + Toolbar + d.ts），控制 Fractured 模式按钮显隐（默认 true） |
| BaseDialog | 透传 | el-dialog，defineModel 双向绑定 |
| BaseForm | 透传 | el-form，卡片式容器；内部 el-form 实例方法（validate/validateField/resetFields/clearValidate）经 defineExpose 暴露，父组件 `ref` 可直接调用 |
| BaseFormItem | 透传 | el-form-item |
| BaseIcon | 透传 | el-icon，hover 动画 |
| BaseInput | 透传 | el-input，支持 autosize |
| BasePageHeader | 透传 | 页面标题栏 |
| BaseRadioGroup | **配置式** | el-radio-group，options 驱动，泛型值，支持 button 模式 |
| BaseJsonSchemaViewer | 透传 | 基于 `cf-json-schema-viz`（React）经 `veaury` `applyPureReactInVue` 桥接的 JSON Schema 树形查看器；`schema` 必传，支持 `defaultExpandedDepth`/`expanded`（默认全展开）/`disableCrumbs`/`renderRootTreeLines`/`emptyText`；容器高度经 ResizeObserver 测量后透传 `max-height`；样式变量映射到 Element Plus CSS 变量实现换肤。依赖 react/react-dom/veaury/cf-json-schema-viz，已在 `vite.config.mts` `optimizeDeps.include` 预构建。注意：`@stoplight/json-schema-tree` 只相对传入的根 schema 解析 `$ref`，传入孤立 schema 时嵌套引用无法展开，调用方需先用 `dereferenceSchema` 深解引用 |
| BaseTable | **配置式** | columns 配置驱动，cell 使用 TSX 渲染 |
| BaseSelect | **配置式** | options 配置驱动，泛型选择器 |
| BaseTabs | **配置式** | tabs 配置驱动，泛型 tab key，内容通过 `#tab-{key}` 具名插槽 |
| BaseTabButton | 透传 | 标签页按钮（AppTabs 用）：`label`/`active`/`closable` props，点击 emit `click`，关闭图标常显（closable 时）点击 emit `close`；激活态主色实心，关闭图标 hover 变红 |
| BaseTabularViewer | **配置式** | 通用类表格文本查看器（CSV/Properties 等），`format` prop 决定表格解析方式（`csv` RFC 4180、`properties` 按 `=`/`:` 拆键值对并跳过 `#`/`!` 注释行，列头固定为 键/值）；顶部工具栏（BaseRadioGroup button 模式）切换 表格/原文 视图，含「自动换行」开关（BaseCheckbox，`v-model:wrap`）和「复制」按钮（navigator.clipboard）；视图模式 `v-model:mode`；深色 sticky 表头 + 斑马纹 + 列间竖线（`showGridLines`），外层统一边框白底，与 BaseTable 样式区分 |

其中 BaseTable、BaseSelect、BaseRadioGroup、BaseTabs 为**配置式封装**，不同于简单透传：

- **BaseTable `<T extends object>`** — 通过 `columns: BaseTableColumnConfig<T>[]` 配置驱动，`cell` 渲染函数使用 TSX（需 `@vitejs/plugin-vue-jsx`，`tsconfig.json` 设 `jsxImportSource: "vue"`），替代 `<el-table-column>` 手写。`BaseTableColumnConfig` 类型定义在 `./types.ts`。
- **BaseSelect `<T, TItem>`** — 通过 `options` / `labelKey` / `valueKey` / `labelGetter` / `valueGetter` 配置选项，替代 `<el-option>` 手写循环。
- **BaseRadioGroup `<T>`** — 通过 `options: BaseRadioOption<T>[]`（`label` / `value` / `disabled`）配置选项，`button` prop 切换 `el-radio-button` / `el-radio` 渲染，泛型值约束为 `string | number | boolean`。

### 前端关键文件

| 文件 | 职责 |
|------|------|
| `stores/auth.ts` | 用户信息、系统角色、`activeProjectSlug`；`activeProjectName` / `projectRole` 为从 project store `bySlug` map 派生的 computed，`setActiveProject(slug)` 只写 slug + localStorage |
| `stores/project.ts` | 用户参与的项目列表 + `bySlug` computed（slug=`code||id` → Project）；`auth.init()` 启动加载（`loaded` 守卫），增删改（`create`/`update`/`remove`）统一走 store 保证 map 一致，`clear()` 供 logout 调用 |
| `stores/translation.ts` | 翻译列表、GroupedRow 类型 |
| `stores/loading.ts` | 全局 loading 遮罩 |
| `stores/tabs.ts` | 顶部标签页（AppTabs）：已打开页面列表、activePath、增删标签（首页标签为固定首项，不在 store 中，不可关闭，右键只显示「关闭右侧/关闭其他」）；`renameProjectSlug` 重写项目 tab 路径（code 变更）、`removeProjectTabs` 关闭某项目全部 tab（删除项目） |
| `hooks/useProjectPermission.ts` | 三层权限模型（菜单/功能/数据权限） |
| `api/client.ts` | Axios 实例、401 自动 refresh token；响应拦截器对 `code !== 0` 的业务错误（HTTP 200）统一 reject 并携带 `response`，让各页面 catch 能拿到 `e.response?.data?.message` |
| `router/index.ts` | 路由守卫、auth.init() 初始化；路由 `meta.isStatic: true` 标记固定标签页（不进 tabs store、不可关闭），AppTabs 通过 `router.resolve(path).meta.isStatic` 判断；`meta.perm` 做 URL 直达拦截（`sys:admin`/`sys:super_admin` 按系统角色、`proj:admin`/`proj:maintainer`/`proj:member` 按 URL 项目角色，`hasRoutePermission` 校验，super_admin 项目级恒放行，无权限重定向 `/`）。新增受限页面需设置 `meta.perm` |

### 改动翻译相关功能

1. 先改 `services/translation.ts` → 再改 `controllers/TranslationsController.ts` → `cd backend && pnpm gen` → 最后改前端
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
