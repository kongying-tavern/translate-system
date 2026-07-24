# 空荧酒馆译站

本地化翻译管理平台，支持多语言协作翻译、角色权限管理、多种格式导出。

## 功能

- **翻译管理** — Key 聚合视图，按语言切换编辑，支持全文搜索、标签筛选、未翻译过滤
- **多语言** — BCP 47 标准语言代码，支持别名自定义
- **批量导入** — 扁平 JSON 一键导入 `{ "原文": "译文" }`
- **多格式导出** — 扁平 JSON / 嵌套 JSON / CSV / Properties / XML
- **标签 & 备注** — Key 级标签和备注，跨语言共享
- **RBAC 权限** — 超管 / 高管 / 管理员 / 成员 四级角色
- **项目成员** — 按项目邀请用户，角色隔离
- **OpenAPI 文档** — Swagger UI 自动生成

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Element Plus + Pinia |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | PostgreSQL + Prisma ORM |
| 鉴权 | JWT (access + refresh token) |
| API 文档 | Swagger / OpenAPI 3.0 |

## 快速开始

### 使用 Docker（推荐）

```bash
cp .env.example .env
# 编辑 .env 中的 POSTGRES_PASSWORD 和 JWT_SECRET
docker compose up -d
```

> 修改 `Dockerfile`、`startup.sh`、`pnpm-lock.yaml` 或后端源代码后，需加 `--build` 重新构建：`docker compose up -d --build`。

启动后访问 `http://localhost:20010`。

> 默认端口：前端 `20010`、后端 `20080`、数据库 `20432`，可在 `.env` 中修改。

### 本地开发

#### 环境要求

- Node.js >= 18
- Docker & Docker Compose

#### 1. 启动数据库

```bash
docker compose up -d postgres
```

#### 2. 配置环境变量

```bash
# 后端环境变量
cd backend
cp .env.example .env
# 编辑 backend/.env 中的 DATABASE_URL，指向本地映射的 PostgreSQL
# DATABASE_URL=postgresql://translate:translate123@localhost:20432/kongying_translate
```

> 根目录 `.env` 仅供 Docker 部署使用，本地开发只需配置 `backend/.env`。

#### 3. 初始化数据库

```bash
cd backend
pnpm install
pnpm db:generate
pnpm db:push         # 或用 pnpm db:migrate 走迁移文件
pnpm db:seed         # 导入基础语言数据
```

#### 4. 启动

```bash
# 终端1 - 后端
cd backend && pnpm dev     # -> http://localhost:8080

# 终端2 - 前端  
cd frontend && pnpm install && pnpm dev  # -> http://localhost:3000
```

Swagger 文档: `http://localhost:8080/api-docs`（Docker 部署时为 `http://localhost:20080/api-docs`）

#### 5. 导入翻译文件

```bash
cd backend
npx tsx src/scripts/import-json.ts <项目ID> <JSON文件路径> <语言代码>
# 例如: npx tsx src/scripts/import-json.ts <uuid> ../zh-Hans.json zh-Hans
```

## 项目结构

```
translate-system/
├── backend/
│   ├── Dockerfile
│   ├── startup.sh
│   ├── prisma/
│   │   ├── schema.prisma          # 数据模型
│   │   ├── migrations/            # 数据库迁移文件
│   │   └── seed.ts                # 语言种子数据
│   └── src/
│       ├── index.ts               # Express 入口
│       ├── config.ts              # 环境配置
│       ├── docs/swagger.ts        # OpenAPI 配置
│       ├── lib/                   # 工具库
│       ├── middleware/            # JWT, 权限中间件
│       ├── routes/               # API 路由
│       ├── services/             # 业务逻辑
│       └── scripts/              # 导入脚本
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── api/                   # Axios 请求层
│       ├── components/           # 公共组件
│       ├── layouts/              # 布局
│       ├── router/               # 路由
│       ├── stores/               # Pinia 状态
│       ├── types/                # TypeScript 类型
│       └── views/                # 页面
├── docker-compose.yml
├── .env.example
└── 翻译后台备忘录.txt
```

## 数据库设计

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

context 和 tags 为 Key 级别属性，跨语言共享，不冗余存储。
```

## Slug 系统

项目（Project）和导出模板（ExportTemplate）支持使用 `code` 作为人类可读的标识符。

**创建时需指定 `code`：**

```bash
# 创建项目
curl -X POST /api/v1/projects \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"我的项目","code":"my-project"}'

# 创建导出模板
curl -X POST /api/v1/projects/my-project/exports/templates \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"配置文件","code":"config-json","formatType":"json"}'
```

**访问时可用 `code` 替代 UUID：**

```bash
# 通过 code 访问项目
curl /api/v1/projects/my-project

# 导出时通过 code 引用模板
curl -X POST /api/v1/projects/my-project/exports/generate \
  -d '{"templateSlug":"config-json","languageCodes":["zh-Hans"]}'
```

> 项目中所有带 `:projectSlug` 和 `:templateSlug` 的路由参数均兼容 UUID 和 `code`，UUID 优先级更高。

## 角色权限

| | 超管 | 高管 | 管理员 | 成员 |
|--|:--:|:--:|:--:|:--:|
| 新建项目 | ✅ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ✅ | ❌ | ❌ |
| 翻译/导出 | ✅ | ✅ | ✅ | 仅编辑译文 |
| 项目成员 | 全部 | 管理员及以下 | 仅成员 | ❌ |

首位注册用户自动成为超级管理员，后续注册默认为成员。

## 命令行脚本

详见 [docs/SCRIPTS_GUIDE.md](docs/SCRIPTS_GUIDE.md)。
