/**
 * 将项目 slug（code 或 UUID）编码为 URL 路径段。
 * code 可能包含 `/`、空格等字符，编码后保持单段，后端 Express 会自动解码。
 */
export function encSlug(slug: string): string {
  return encodeURIComponent(slug)
}

/**
 * 解码从路由路径中取出的 slug 段（vue-router 的 params 已自动解码，此函数用于手动拆分路径字符串时）。
 */
export function decSlug(seg: string): string {
  try {
    return decodeURIComponent(seg)
  }
  catch {
    return seg
  }
}
