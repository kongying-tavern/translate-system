# API 文档（Swagger / OpenAPI）

> Swagger UI 与 OpenAPI JSON 的访问方式、暴露开关。

两份 OpenAPI 文档，由同一份代码生成：

| 文档 | 内容 | 可用性 |
|------|------|--------|
| `swagger.json` | JWT 登录态全量接口 | 由 `.env` 开关 `OPENAPI_API_JSON` 控制，默认关闭 |
| `apikey.json` | API Key 开放接口（路径带 `/apikey` 前缀，`x-api-key` + `x-api-secret` 鉴权） | **永远可用** |

Swagger UI 页面本身由 `OPENAPI_SWAGGER` 控制（默认关闭）。三个开关在根 `.env`（生产）或 `backend/.env`（本地开发，默认开启）配置。

## 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| 后端直连 | `http://localhost:8080/api-docs` | Swagger UI 页面 |
| 前端代理 | `http://localhost:3000/openapi/swagger-ui/` | 经 Vite/nginx 的 `/openapi/*` 命名空间转发（生产为 `:21010`） |
| 页面内查看 | 登录后打开「开放接口说明」（`/api-doc`） | 展示 apikey.json 派生内容，登录即可见 |

`/openapi/*` 只是代理命名空间，不保证所有环境可用——业务代码一律不要依赖它。

## JSON 直链

| JSON | 路径 |
|------|------|
| JWT 全量（按需） | `/api-docs/swagger.json`（代理版 `/openapi/api.json`） |
| API Key 开放（恒可用） | `/api-docs/apikey.json`（代理版 `/openapi/apikey.json`） |

两份 JSON 都经过 `backend/src/docs/swagger.ts` 包装增强：
- 中文 tags 分组、JWT 安全方案定义等
- 可直接导入 Apifox / Postman 等工具

## 相关文档

- [部署指南](deployment.md)
- [权限体系](permission-guide.md) —— §4.3 讲开放接口的鉴权与数据权限
- AI 侧契约速查：`.agents/open-api.md`
