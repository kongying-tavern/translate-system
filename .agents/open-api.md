# API Key 鉴权（开放接口）

> 本篇说明开放接口如何用 API Key 鉴权、白名单机制与文档派生方式。

外部自动化可通过 API Key + Secret 访问白名单内的接口。所有接口 `/api/v1/*` 均可，将路径前缀改为 `/api/v1/apikey/`：

```bash
# 导出翻译示例
curl -X POST http://localhost:21080/api/v1/apikey/projects/:projectId/exports/generate \
  -H "x-api-key: ak_xxx" \
  -H "x-api-secret: xxx" \
  -H "Content-Type: application/json" \
  -d '{"templateSlug":"...","languageCodes":["zh-Hans"]}'
```

- **白名单**：backend/src/lib/apikey-whitelist.ts 的 APIKEY_WHITELIST 数组，每条声明「方法 + 路径正则」；新增开放接口追加一条即生效（index.ts 守卫与 services/docs.ts 抽取共用）
- 当前已开放：POST / PUT / DELETE .../translations（Key 增删改，Maintainer+）、GET /languages（只读基础语言表）
- **OpenAPI 文档**：白名单接口派生为 GET /api-docs/apikey.json（buildApiKeyOpenApiSpec）
- 前端「开放接口说明」页经 GET /api/v1/openapi-doc 同逻辑展示（登录可见，不依赖 /openapi/* 代理）
- **管理接口**：GET|POST|PUT|DELETE /api/v1/me/keys（JWT）
  - ApiKeysController 是 @Route('me')，前端不要用 /apikey/ 前缀调用
  - 代理上 tsoa 镜像出的 /apikey/me/keys 被 apiKeyAuth 与白名单双重拦截
- **数据权限**：apiKeyAuth 解析出 Key 所有者的 userId/userRole，再走 assertProjectAccess
  - 因此 API Key 只能操作其所有者拥有成员/owner 身份的项目，能力不会超过所有者
