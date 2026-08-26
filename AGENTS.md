# AGENTS.md — AI 开发指南

**翻译管理平台**：本地化翻译管理系统，前后端分离（Vue 3 + Express + PostgreSQL + Prisma）。本文件是给 AI 协作开发的总入口；面向开发者与用户的文档在 [docs/](docs) 与 [README.md](README.md)。

## 使用方式

按当前任务查阅对应分册（都在 `.agents/` 下），不要凭记忆猜测项目约定。改代码前先读相关分册；拿不准时用 grep 在 `.agents/` 内检索关键词。

## 分册目录

| 分册 | 内容 | 何时读 |
|------|------|--------|
| [overview.md](.agents/overview.md) | 技术栈、目录结构、Docker / 后端 / 前端 / patch / lint 全部常用命令 | 启动、构建、脚本操作前 |
| [code-standards.md](.agents/code-standards.md) | 密码规范、TypeScript（禁 any）、LF 行尾等硬性规范 | 写任何代码前 |
| [data-model.md](.agents/data-model.md) | 表结构、原文存储约定（源语言 value）、索引约定 | 改 schema / 查询 / 建索引前 |
| [backend.md](.agents/backend.md) | 后端分层、tsoa 用法与陷阱、错误处理、API 路由总表、OpenAPI 文档策略 | 新增/修改接口前 |
| [frontend.md](.agents/frontend.md) | 前端分层、project store 的职责、关键文件速查 | 新增/修改页面或状态前 |
| [base-ui.md](.agents/base-ui.md) | Base UI 封装规则与全部组件速查表 | 用 Element Plus 组件 / 新增封装前 |
| [slug.md](.agents/slug.md) | Slug 双解析约定、encPathParam/decPathParam 路径编码铁律 | 拼 API 路径 / 路由参数前 |
| [permissions.md](.agents/permissions.md) | 系统/项目角色核心矩阵、三层权限模型、鉴权链 | 加页面/接口/菜单前（详细版 docs/permission-guide.md） |
| [import-export.md](.agents/import-export.md) | 导入解析校验、并发锁与进度 SSE、导出 8 种格式与模板 config | 动导入/导出功能前 |
| [translation.md](.agents/translation.md) | 翻译管理页虚拟滚动、滚动降级、IME 守卫、排序机制、回归测试要点 | 动翻译页面前 |
| [open-api.md](.agents/open-api.md) | API Key 鉴权、开放接口白名单、文档派生 | 动开放接口/API Key 前 |
| [workflow.md](.agents/workflow.md) | 翻译功能改动流程、schema 迁移规则、常见问题排查 | 排障 / 规划改动顺序时 |
| [documentation.md](.agents/documentation.md) | 文档受众分区、命名、结构模板与写作风格 | 新建/修改任何 .md 前 |

## 硬性规范速览

1. TypeScript 禁 `any`（用 `unknown`）；`catch (e: unknown)`；文本文件 LF + 末尾空行
2. 改控制器后必须 `cd backend && pnpm gen`；改 schema 必须走迁移文件（禁止 db:push 绕过部署）
3. 提交前双端 `pnpm lint` 全绿（ESLint + tsc / vue-tsc）
4. 前端路径参数一律 encPathParam()，读取 route.params 一律 decPathParam()，禁止百分号编码
5. 编辑类翻译操作统一 keyId 定位，不用 key 字符串拼路径
6. 第三方 / 原生 UI 组件（Element Plus、React 桥接、自绘复合件等）必须经封装层使用——`@/components/ui` 的 Base 或 `@/components/common`，barrel 导入、禁深路径
7. 权限判断统一走 useProjectPermission / assertProjectAccess，不要散落硬编码角色字符串
8. 业务错误抛 AppError(ErrCode.*, 中文 message)；预期路径日志只打单行 warn 不打堆栈

## 文档写作规范

完整规则见 [documentation.md](.agents/documentation.md)。速记两条：

- 不用术语黑话（唯一真相 / 单源 / 单飞），直说文件与规则
- 一个要点一行，多方面信息拆子条目或表格
