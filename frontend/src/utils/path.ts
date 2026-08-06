/**
 * 将任意 URL 路径参数（项目 slug、Key、语言代码、UUID 等）编码为单段路径。
 * 路径参数可能包含 `/`、空格等字符，编码后保持单段，后端 Express 会自动解码 `%2F`。
 * 接口内所有路径参数位置必须使用本函数，禁止裸用 encodeURIComponent。
 */
export function encPathParam(seg: string): string {
  return encodeURIComponent(seg)
}

/**
 * 解码从路由路径中取出的路径参数段（vue-router 的 params 已自动解码，此函数用于手动拆分路径字符串时）。
 */
export function decPathParam(seg: string): string {
  try {
    return decodeURIComponent(seg)
  }
  catch {
    return seg
  }
}
