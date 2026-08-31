# 项目概述与常用命令

> 本篇说明技术栈、目录结构与常用命令（构建/启动/lint）。

## 项目概述

本地化翻译管理平台，前后端分离。Vue 3 + Express + PostgreSQL + Prisma。

## 技术栈与目录

- `backend/` Express + tsoa（注解式路由）+ Prisma Client，端口 8080
- `frontend/` Vue 3 + Pinia + vue-router + Element Plus（Base UI 封装），端口 3000
- 根 `docker-compose.yml`：postgres / backend / frontend（生产部署，默认端口 21432 / 21080 / 21010，跟随根 `.env`）
- `docs/` 面向开发者与用户的文档（如 `permission-guide.md`）

## 常用命令

```bash
# Docker（端口在 .env 中配置，默认 21080/21010/21432；项目名/容器名跟随 COMPOSE_PROJECT_NAME）
docker compose up -d             # 启动全部服务（生产部署）
docker compose up -d --build     # 重新构建镜像并启动
docker compose up -d postgres    # 仅启动数据库（本地开发用，AI 自动执行）
docker compose down              # 停止所有服务
docker compose logs -f           # 查看日志

# 后端 (localhost:8080)
cd backend && pnpm dev           # tsx watch 热重载（predev 会自动先跑 pnpm gen）
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
cd frontend && pnpm patch-commit "node_modules\\.pnpm_patches\\data-visor-vue@0.0.4"
cd frontend && pnpm install      # 将 patch 应用到 node_modules
rm -rf node_modules/.vite        # patch 生效后必须清 Vite 缓存
# 注意：patch 目录存在时再次 pnpm patch 会报 ERR_PNPM_EDIT_DIR_NOT_EMPTY，直接编辑现有目录再 patch-commit 即可

# 批量导入翻译（详见 docs/scripts-guide.md）
cd backend && pnpm tsx src/scripts/import_translations/SCRIPT.sh -e <endpoint> -k <apikey> -s <secret> -p <project> -t json -l <lang> -f <file>

# Lint + 类型检查（提交前必须执行）
cd backend && pnpm lint            # ESLint + tsc
cd backend && pnpm lint:fix        # 自动修复 + tsc（仅修复格式，剩余需手动处理）
cd frontend && pnpm lint           # ESLint + vue-tsc
cd frontend && pnpm lint:fix       # 自动修复 + vue-tsc（仅修复格式，剩余需手动处理）
```
