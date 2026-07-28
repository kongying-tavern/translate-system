# 空荧酒馆译站

本地化翻译管理平台，支持多语言协作翻译、角色权限管理、多种格式导出。

## 功能

- **翻译管理** — 按翻译条目（Key）聚合展示，支持按语言切换编辑、全文搜索、标签筛选、仅看未翻译
- **多语言** — 采用标准语言代码（BCP 47），支持别名自定义
- **批量导入** — 扁平 JSON 一键导入 `{ "原文": "译文" }`
- **多格式导出** — JSON（扁平/嵌套）、YAML（扁平/嵌套）、Properties、XML（扁平/嵌套）、CSV
- **标签 & 备注** — 每条翻译条目可添加标签和备注，所有语言共享
- **权限管理** — 超管 / 管理员 / 普通用户 三级系统角色
- **项目成员** — 按项目邀请用户，可分配管理员 / 维护者 / 成员角色
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

- Node.js >= 20
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
pnpm db:push         # 初始化数据库
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
pnpm tsx src/scripts/import-json.ts <项目ID> <JSON文件路径> <语言代码>
# 例如: pnpm tsx src/scripts/import-json.ts <uuid> ../zh-Hans.json zh-Hans
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

## 数据结构

每条待翻译的原文称为一个**翻译条目**，一个条目可包含原文、上下文说明和标签，这些信息在所有语言中共享。

针对每个条目，你可以在不同语言下分别填入对应的译文。不同语言的译文独立保存，互不影响。

## 角色权限

系统有**系统角色**和**项目角色**两层权限划分。

### 系统角色

系统角色决定你在平台整体上的操作范围：

- **超管** — 全部权限：可以新建项目、管理系统用户、翻译导出、管理所有项目成员。首位注册的用户自动成为超管。
- **管理员** — 可进行完整的翻译和导出操作，管理已加入项目的成员，但不能新建项目和管理系统用户。
- **普通用户** — 仅可编辑译文。

新注册的用户默认为普通用户。

### 项目角色

项目创建后，可以邀请其他用户加入项目并分配角色。项目角色决定用户在项目内的操作权限：

- **管理员** — 拥有项目内的全部权限：修改项目设置、管理项目成员、管理语言和导出、翻译、增删翻译条目。
- **维护者** — 可以进行翻译和增删翻译条目，但不能修改项目设置和管理成员。
- **成员** — 仅可编辑译文，不能增删翻译条目。

系统超管对所有项目拥有管理员级别的全部权限。

## 命令行脚本

详见 [docs/SCRIPTS_GUIDE.md](docs/SCRIPTS_GUIDE.md)。
