/**
 * API Key 代理白名单。
 * 外部自动化只能通过 `x-api-key` + `x-api-secret` 访问以下接口，
 * 以 `/projects/...` 项目资源为主，另含静态只读的 `/languages`（均相对 `/api/v1/apikey` 前缀）。
 */
export const APIKEY_WHITELIST = [
  { method: 'GET', path: /^\/languages$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/translations$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/translations\/count$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/translations\/tags\/list$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/languages$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/imports\/entries$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/imports\/translations$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/translations$/ },
  { method: 'DELETE', path: /^\/projects\/[^/]+\/translations\/[^/]+$/ },
  { method: 'PUT', path: /^\/projects\/[^/]+\/translations\/(?!sortOrders)[^/]+$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/exports\/templates\/[^/]+$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/exports\/preview$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/exports\/generate$/ },
] as const
