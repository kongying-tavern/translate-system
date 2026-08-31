# 翻译管理平台

本地化翻译管理平台：以「项目 → 语言 → Key/译文」为核心，支持多语言协作翻译、角色权限管理与多种格式导入导出。

## 功能特性

- **翻译管理** — 按翻译条目（Key）聚合展示，语言切换编辑、全文搜索（支持 `#行号` / `/正则/`）、标签筛选、仅看未翻译；虚拟滚动支撑海量数据
- **多语言** — 标准语言代码（BCP 47），支持代码别名（导出键名）与名称别名（显示名称）
- **批量导入** — JSON / YAML / XML / CSV / Properties 自动识别，条目与译文两种模式；后台异步执行 + 实时进度 + 同项目互斥锁 + 可中止
- **多格式导出** — JSON（扁平/嵌套）、YAML（扁平/嵌套）、Properties、XML（扁平/嵌套）、CSV，模板化配置可复用
- **标签 & 备注** — 每条翻译条目可添加标签和备注，所有语言共享
- **权限管理** — 超管/管理员/普通用户三级系统角色 + 项目管理员/维护者/成员三级项目角色，菜单/功能/数据三层权限模型
- **开放接口** — API Key + Secret 鉴权的自动化接口，OpenAPI 文档自动派生

> AI 协作开发请看 [AGENTS.md](AGENTS.md)（分册在 `.agents/`）；人类文档都在 [docs/](docs)。

## 快速开始

**Docker 一键部署（推荐）**

```bash
cp .env.example .env    # 编辑 POSTGRES_PASSWORD 和 JWT_SECRET
docker compose up -d --build
# 启动后访问前端入口，端口跟随 .env（默认 http://localhost:21010）
```

**本地开发（三步）**

```bash
docker compose up -d postgres            # 1. 启动数据库
cd backend && pnpm install && pnpm dev   # 2. 后端 localhost:8080
cd frontend && pnpm install && pnpm dev  # 3. 前端 localhost:3000
```

> 首次运行前需配置子目录 `.env` 并初始化数据库，详见 [docs/development.md](docs/development.md)。首位注册用户自动成为超管。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Element Plus（Base UI 封装）+ Pinia |
| 后端 | Node.js + Express + TypeScript + tsoa |
| 数据库 | PostgreSQL + Prisma ORM |
| 鉴权 | JWT（access + refresh token）、API Key（开放接口） |
| API 文档 | Swagger / OpenAPI 3.0 |

## 文档目录

| 文档 | 内容 |
|------|------|
| [docs/development.md](docs/development.md) | 本地开发：环境变量两层配置、数据库初始化、启动步骤 |
| [docs/deployment.md](docs/deployment.md) | Docker 部署与大文件上传调优（200MB / 超时 / Node 堆内存） |
| [docs/api-docs.md](docs/api-docs.md) | Swagger UI 与 OpenAPI JSON 的访问入口、代理路径、暴露开关 |
| [docs/permission-guide.md](docs/permission-guide.md) | 权限体系完整说明（三维模型 / 前后端对照表 / 维护指引） |
| [docs/scripts-guide.md](docs/scripts-guide.md) | 命令行脚本使用说明（API Key 批量导入等） |
| [docs/positioning.md](docs/positioning.md) | 项目亮点分受众介绍（官网文案 / 汇报可用） |
| [AGENTS.md](AGENTS.md) | AI 协作开发指南入口（`.agents/` 下有 12 个专题分册） |

## 脚本参数规范

`backend/src/scripts/` 下每个脚本一个子目录，成对固定提供 `SCRIPT.ps1` 与 `SCRIPT.sh` 两种实现，两者的参数必须对齐：

1. **参数一一对应** — 同一逻辑参数的 ps1 与 sh 长短名完全对应，例：`-ProjectSlug` ↔ `--project-slug`（详见各脚本说明）。
2. **仅格式不同** — 两边用的是同一个参数单词，只是格式按各自平台习惯：ps1 用 PascalCase（`-ApiKey`），sh 用 kebab-case（`--api-key`）。除格式外，必填、默认值、枚举与语义都一致。
3. **短参数避免大小写撞车** — ps1 参数名大小写不敏感，`-n` 与 `-N` 会被当成同一个参数。因此短参数不要保留仅靠大小写区分的两个字母（例如 no-code-alias 用 `-c`、no-name-alias 用 `-n`），避免 `-n` / `-N` 并存。
4. **短参数避让 `-h` / `-v`** — `-h` 约定保留给帮助（help）、`-v` 保留给版本（version），业务短参数不用这两个字母。需要帮助时 ps1 用 `-?`、sh 用 `-h, --help`（如 Deploy 的服务器地址用 `-s`,不用 `-h`）。

完整说明与各脚本参数对照见 [docs/scripts-guide.md](docs/scripts-guide.md)。

## 角色权限速览

- **系统角色**：超管（全部权限，首位注册者自动获得）/ 管理员（用户管理与日常协作）/ 普通用户（默认，仅编辑译文）
- **项目角色**：管理员（项目内全部权限）/ 维护者（内容管理）/ 成员（仅编辑译文）
- 系统 super_admin 对所有项目拥有管理员级别权限；详细矩阵见 [docs/permission-guide.md](docs/permission-guide.md)
