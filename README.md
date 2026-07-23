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

### 环境要求

- Node.js >= 18
- PostgreSQL >= 16

### 1. 创建数据库

```sql
CREATE USER translate WITH PASSWORD 'translate123';
CREATE DATABASE translate_ai OWNER translate;
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 中的 DATABASE_URL
```

### 3. 初始化数据库

```bash
cd backend
npm install
npx prisma db push
npx prisma generate
npx tsx prisma/seed.ts    # 导入基础语言数据
```

### 4. 启动

```bash
# 终端1 - 后端
cd backend && npm run dev     # -> http://localhost:8080

# 终端2 - 前端  
cd frontend && npm install && npm run dev  # -> http://localhost:3000
```

Swagger 文档: `http://localhost:8080/api-docs`

### 5. 导入翻译文件

```bash
cd backend
npx tsx src/scripts/import-json.ts <项目ID> <JSON文件路径> <语言代码>
# 例如: npx tsx src/scripts/import-json.ts <uuid> ../zh-Hans.json zh-Hans
```

## 项目结构

```
translate-ai/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 数据模型
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
│   └── src/
│       ├── api/                   # Axios 请求层
│       ├── components/           # 公共组件
│       ├── layouts/              # 布局
│       ├── router/               # 路由
│       ├── stores/               # Pinia 状态
│       ├── types/                # TypeScript 类型
│       └── views/                # 页面
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

## 角色权限

| | 超管 | 高管 | 管理员 | 成员 |
|--|:--:|:--:|:--:|:--:|
| 新建项目 | ✅ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ✅ | ❌ | ❌ |
| 翻译/导出 | ✅ | ✅ | ✅ | 仅编辑译文 |
| 项目成员 | 全部 | 管理员及以下 | 仅成员 | ❌ |

首位注册用户自动成为超级管理员，后续注册默认为成员。
