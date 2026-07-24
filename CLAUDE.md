# 空荧酒馆译站 — AI 开发指南

## 项目概述

本地化翻译管理平台，前后端分离。Vue 3 + Express + PostgreSQL + Prisma。

## 常用命令

```bash
# 后端 (localhost:8080)
cd backend && pnpm dev           # tsx watch 热重载
pnpm db:generate                 # 重新生成 Prisma Client
pnpm db:push                     # 推送 schema 到 DB（保留数据）
pnpm db:seed                     # 灌入基础语言数据
pnpm db:migrate                  # 生成并执行迁移文件

# 前端 (localhost:3000)
cd frontend && pnpm dev          # Vite HMR
rm -rf node_modules/.vite        # 清除 Vite 缓存（模块找不到时）

# Docker（端口在 .env 中配置，默认 21080/21010/21432）
docker compose up -d             # 启动全部服务（首次或改 Dockerfile 后加 --build）
docker compose up -d --build     # 重新构建镜像并启动
docker compose up -d postgres    # 仅启动数据库（本地开发用）
docker compose down              # 停止服务
docker compose logs -f           # 查看日志

# 导入翻译文件
cd backend && pnpm tsx src/scripts/import-json.ts <projectId> <file> <langCode>
```

## 核心架构

### 数据层

```
translation_keys (Key 级属性: context, tags) 1:N translation_values (按语言的值: translatedText)
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

| 角色 | 新建项目 | 用户管理 | 翻译/导出 | 项目成员操作 |
|------|:--:|:--:|:--:|:--:|
| super_admin | ✅ | ✅ | ✅ | 全部 |
| senior_admin | ❌ | ✅(不能管超管) | ✅ | 管理员及以下 |
| admin | ❌ | ❌ | ✅ | 仅成员 |
| member | ❌ | ❌ | 仅编辑译文 | ❌ |

权限常量: `ROLE_LEVEL = { super_admin:4, senior_admin:3, admin:2, member:1 }`

### API 路由

所有接口 `/api/v1/*`，统一响应 `{ code: 0, message, data }`。

```
/auth/register|login|refresh|me        — 公开 (除了 me)
/auth/users|users/:id/role|users/:id/password  — 需 auth + admin+
/projects CRUD                          — 需 auth
/projects/:id/translations              — 需 ownership
/projects/:id/translations/key/:oldKey  — PUT 更新 Key (必须在 /:key/:langCode 之前)
/projects/:id/translations/:key/:langCode — PUT 保存译文/标签/备注
/projects/:id/translations/tags/list     — GET 标签列表
/projects/:id/languages/:code/alias      — PUT 语言别名
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

### 导出模板 config 字段

```json
{ "skipIdentical": true, "skipEmpty": true, "useCodeKey": false }
```

### 常见问题

1. **Vite 模块找不到** — `rm -rf node_modules/.vite && pnpm dev`
2. **Prisma 文件锁** — `rm -rf node_modules/.prisma && npx prisma generate`
3. **`psql` 中文乱码** — 用 `npx tsx -e "import{PrismaClient}..."` 查数据
4. **路由冲突** — `/:key/:langCode` 会吃掉 `/key/:oldKey`，必须把 literal 路由放前面
5. **`cannot edit` 报错** — GateGuard hook，用 `ECC_GATEGUARD=off` 前缀或加到 `settings.json`

### 前端关键文件

| 文件 | 职责 |
|------|------|
| `stores/auth.ts` | 用户信息、角色、activeProjectId |
| `stores/translation.ts` | 翻译列表、GroupedRow 类型 |
| `stores/loading.ts` | 全局 loading 遮罩 |
| `api/client.ts` | Axios 实例、401 自动 refresh token |
| `router/index.ts` | 路由守卫、auth.init() 初始化 |

### 改动翻译相关功能

1. 先改 `services/translation.ts` → 再改 `routes/translations.ts` → 最后改前端
2. 如果需要新字段，改 `prisma/schema.prisma` → `pnpm db:push` 或 `pnpm db:migrate` → 更新 service
3. 翻译列表分页在 `listGrouped` 中处理，导出不过滤在 `getForExport`
