# Slug 与 URL 路径参数编码

> 本篇说明 Slug 双解析约定与路径参数编解码铁律。

## Slug 是什么

- `:projectSlug`、`:templateSlug` 这类路径参数统称 Slug
- **同时接受 UUID 和 code**：接口内先按 UUID 查，未命中再按 code 查
- 展示优先用 code（可读标识符，如 my-project），没有 code 才回退 UUID

## 统一解析入口

- 项目：`services/project.ts` 的 `resolveProject(identifier)`
  - 先按 UUID 正则判断，合法才查 id 列，否则按 code 查——避免非法值打到 UUID 列报错
- 模板：`services/export/index.ts` 的 `resolveTemplate(templateSlug, projectSlug)`

## 路径参数编码（前端侧）

- 为什么需要：路径参数可能含 `/`、空格、非 ASCII 字符
- 拼 API 路径或路由路径时，一律用 `utils/path.ts` 的 `encPathParam()` 编码为单段：
  - 只含 unreserved 字符（[A-Za-z0-9_.~-]）→ 原样返回
  - 含特殊字符 → URL-safe Base64（去 padding、+→-、/→_）并加 `b64_` 前缀
- **禁止百分号编码**：nginx 的 merge_slashes 会把 %2F 还原成字面 `/` 并合并斜杠，key 失真（UAT 实测）；Base64 完全免疫
- **禁止裸用 encodeURIComponent**

## 解码约定

- 后端：所有 controller 类级挂 `@Middlewares(decodePathParams)`，在 handler 前解码 req.params（b64_ 前缀才解码，无前缀原样返回，兼容旧客户端）
- vue-router 只做百分号解码、不认 b64_：
  - 所有读取 route.params 的地方必须用 `decPathParam()` 还原
  - 覆盖场景：各 view 的 computed、AppTabs 的 resolved.params、路由守卫
  - tabs store 的 isProjectPath / renameProjectSlug 内部已按编码后路径比较替换，无需再处理