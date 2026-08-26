# 后端分层（tsoa 注解式路由）

> 本篇说明后端分层、tsoa 注解式路由、错误处理与接口总表。

## 调用链与关键文件

```
controllers/ → services/ → Prisma Client
```

**鉴权与工具（lib/、middleware/）**

- `authentication.ts` —— tsoa expressAuthentication：@Security('auth'/'admin')，解析 JWT 或复用 apiKey 预置身份，回写 req.userId/userRole
- `lib/access.ts` —— assertProjectAccess(userId, userRole, slug, minProjectRole?) / assertSystemRole(role, minRole)
- `lib/api.ts` —— ok<T>() / okPage<T>() 统一响应包装 { code, message, data }
- `lib/prisma.ts` —— PrismaClient 单例（独立文件，避免 tsoa 扫描循环依赖）
- `middleware/auth.ts` —— AuthRequest 类型；各控制器 @Request() req 注入
- `middleware/decodePathParams.ts` —— 类级 @Middlewares 挂在所有含 @Path 的 controller 上，统一解码 b64_ 前缀路径参数

**错误处理约定（middleware/errorHandler.ts）**

- AppError → 业务错误 HTTP 200 + code；鉴权失败 → 401
- tsoa ValidateError → code 1000，英文校验信息格式化为中文
- body-parser 错误：超限 413 / 非法 JSON 400
- 预期路径只打单行 console.warn（含 method/url/code/message），**不打堆栈**——access token 每 15min 过期的常规 401 靠前端静默刷新消化，勿改回无条件 console.error
- 仅未预期异常才打完整堆栈并返回 500

**OpenAPI 文档产物（backend/src/docs/）**

- `swagger.ts` —— 手写包装层（补 tags 分组/安全方案/描述），必须提交
- `routes.ts` + `swagger.json` —— tsoa 生成产物，pnpm gen 自动生成，勿手改；已 gitignore（docs/* + !swagger.ts），由 predev 与 Dockerfile 自动生成

## tsoa 用法与陷阱

控制器注解：`@Route` / `@Get|Post|Put|Delete` / `@Path` / `@Query` / `@Body` / `@Security`。改完控制器必须 `cd backend && pnpm gen`。

| # | 陷阱 | 正确做法 |
|---|------|----------|
| 1 | 内联字面量类型 `{ deleted: true }` 让 tsoa 崩溃 | 必须命名接口（如 DeletedResult） |
| 2 | 不支持可选路径参数 {langCode?} | 拆成两条路由 |
| 3 | 路由注册顺序 = 方法声明顺序 | literal 路由（sortOrders/batch/count）声明在参数路由之前 |
| 4 | 响应类型 | Date 序列化为 ISO；可空用 string \| null；Prisma 行与 Row 接口不一致时 as unknown as 转换 |
| 5 | 字段描述 | 属性上方 /** 中文 */ JSDoc 映射为 schema description；Prisma 模型不穿透，需自定义 Row 接口 + JSDoc；示例用 @example（合法 JSON） |
| 6 | 参数描述 | 方法 JSDoc @param 必须覆盖全部参数（req→path/query→body），@summary 放最后，否则 lint warning |
| 7 | Key 含任意字符 | 编辑类操作一律 keyId 定位（UUID 稳定），不用 key 拼 URL |

## API 文档与暴露策略

- 所有接口 `/api/v1/*`，统一响应 `{ code: 0, message, data }`
- `/openapi/*` 仅是文档代理命名空间，业务代码不得依赖
- 文档页面 `/api-docs` 下拉切换两份 JSON：swagger.json（JWT 全量）/ apikey.json（API Key 开放接口）
- apikey.json **永远暴露**；其余由 .env 的 OPENAPI_SWAGGER / OPENAPI_API_JSON 控制（经 docker-compose 透传）
- docs/swagger.ts 包装层补充：顶层 tags（TAG_DESCRIPTIONS，新增分组需同步）、securitySchemes、info.description、修正 Record 描述
- 原始 JSON 直链须注册在 swaggerUi.serve 之前，否则被 SPA 回退吞掉
- 前端「开放接口说明」页经 GET /api/v1/openapi-doc 同逻辑派生展示

## API 路由总表

### 认证与用户（/auth）

```
POST   /auth/register|login|refresh    — 公开，login 支持用户名或邮箱
GET    /auth/me                        — 需 auth
GET    /auth/users                     — 需 admin+
PUT    /auth/users/:id/role            — 改角色（admin+，不能动 super_admin / 越级提升）
POST   /auth/users                     — 创建用户（admin+，只能创建 user）
PUT    /auth/users/:id/password        — 重置密码（admin+）
DELETE /auth/users/:id                 — 删除用户（admin+，不能删 super_admin）
```

### 项目（/projects）

```
GET    /projects                       — 仅返回自己参与的项目
POST   /projects                       — 创建（仅 super_admin）
PUT|DELETE /projects/:id               — 编辑/删除（仅 super_admin）
GET    /projects/:id                   — 需项目访问（super_admin/owner 放行）
```

### 翻译（/translations）

```
GET    /projects/:id/translations      — 需项目访问
POST   /projects/:id/translations      — 新增 Key（Maintainer+）
PUT    .../translations/sortOrders     — 批量排序（Maintainer+）
POST   .../translations/batch          — 批量导入（Maintainer+）
PUT    .../translations/{keyId}        — 更新 key 级属性（keyId 定位）
PUT    .../translations/{keyId}/{langCode} — 保存译文（任意成员；拒绝源语言与非项目语言）
DELETE .../translations/{translationId} — 删除 Key（Maintainer+）
GET    .../translations/count|tags/list — 需项目访问
```

### 导入 / 导出 / 语言 / 成员 / 布局

```
GET    /projects/:id/imports/status         — 导入状态（2s 轮询进度，空闲 30s）
POST   /projects/:id/imports/entries|translations — 批量导入（立即返回 accepted）
POST   /projects/:id/imports/abort          — 中止（发起人或 super_admin）
GET|POST|PUT|DELETE /projects/:id/layouts/templates|configs — 布局模板/配置 CRUD
GET    /projects/:id/languages              — 需项目访问
POST|DELETE /projects/:id/languages          — 增删语言（源语言不可删）
PUT    /projects/:id/sourceLanguage         — 设置源语言（Maintainer+）
PUT    /projects/:id/languages/:code/codeAlias|nameAlias|sortOrder — 别名/排序
GET    /projects/:id/members                — 需项目访问
POST   /projects/:id/members                — 添加成员（Project-Admin）
PUT    /projects/:id/members/:id/role       — 修改成员角色（Project-Admin）
DELETE /projects/:id/members/:id            — 移除成员（Project-Admin）
GET    /projects/:id/exports/templates      — 需项目访问
POST|PUT|DELETE /projects/:id/exports/templates — 导出模板增删改（Maintainer+）
POST   /projects/:id/exports/preview|generate — 预览/生成
```

### 其他

```
GET|POST|PUT|DELETE /me/keys               — API Key CRUD（JWT）
GET    /openapi-doc                        — 开放接口文档
GET    /languages|/languages/search        — 基础语言
```
