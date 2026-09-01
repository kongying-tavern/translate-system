# 本地开发指南

> 面向开发者的本地开发指南。

## 环境要求

- Node.js ≥ 20（推荐 22 LTS）、pnpm 9+
- Docker & Docker Compose（本地开发也需要 postgres 容器）

## 启动步骤

### 1. 启动数据库

```bash
docker compose up -d postgres
```

### 2. 配置环境变量

```bash
# 后端环境变量
cd backend
cp .env.example .env
# 编辑 backend/.env 中的 DATABASE_URL，指向本地映射的 PostgreSQL

# 前端环境变量
cd ../frontend
cp .env.example .env
```

> 根目录 `.env` 仅供 Docker 部署使用，本地开发配置相应子目录的 `.env`。

各层环境变量采用两层配置：

| 文件 | 用途 | 读取方式 |
|------|------|----------|
| `backend/.env` | 本地后端开发 | dotenv 直接读取 |
| `frontend/.env` | 本地前端开发 | Vite 构建时读取 |
| 根 `.env` | Docker Compose 部署 | 通过 docker-compose.yml 传入各容器 |

### 3. 初始化数据库

```bash
cd backend
pnpm install
pnpm db:generate              # 生成 Prisma Client
pnpm prisma migrate deploy    # 应用全部迁移（推荐）
```

> `pnpm db:push` 仅限本地快速原型，不产生迁移文件；生产部署由 `prisma migrate deploy` 执行迁移。

### 4. 启动

```bash
# 终端1 - 后端（predev 会自动先生成 tsoa 路由）
cd backend && pnpm dev        # -> http://localhost:8080

# 终端2 - 前端
cd frontend && pnpm install && pnpm dev   # -> http://localhost:3000
```

首位注册的用户自动成为超级管理员（super_admin）。

## 导入翻译

批量导入翻译内容使用 `import_translations` 命令行脚本（API Key 自动化），详见 [脚本系统](scripts.md)。

## 相关文档

- [部署指南](deployment.md)
- [权限体系](permission-guide.md)
- [脚本系统](scripts.md)
