const B64_PREFIX = 'b64_'

/**
 * 将任意 URL 路径参数（项目 slug、Key、语言代码、UUID 等）编码为单段路径。
 * 只含 URL unreserved 字符（`[A-Za-z0-9_.~-]`）的值原样返回（保持可读、兼容旧行为）；
 * 含 `/`、空格、非 ASCII 等特殊字符的值用 URL-safe Base64 编码并加 `b64_` 前缀——
 * 百分号编码的 `%2F` 会被 nginx 的 `merge_slashes`/URL 解码改写失真，Base64 产物对链路完全免疫。
 * 接口内所有路径参数位置必须使用本函数，禁止裸用 encodeURIComponent。
 */
export function encPathParam(seg: string): string {
  if (!seg || /^[\w.~-]+$/.test(seg))
    return seg
  const b64 = btoa(unescape(encodeURIComponent(seg)))
  return `${B64_PREFIX}${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/**
 * 解码从路由路径中取出的路径参数段。
 * vue-router 只做百分号解码，不解 `b64_` 前缀的 Base64，此函数用于读取 `route.params` 或手动拆分路径字符串时还原。
 * 无前缀的值原样返回（普通字符 slug/id/langCode 不受影响）。
 */
export function decPathParam(seg: string | undefined): string | undefined {
  if (!seg || !seg.startsWith(B64_PREFIX))
    return seg
  const raw = seg.slice(B64_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(escape(atob(raw)))
  }
  catch {
    return seg
  }
}
