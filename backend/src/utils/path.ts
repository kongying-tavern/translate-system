import { Buffer } from 'node:buffer'

const B64_PREFIX = 'b64_'

/**
 * 解码前端 encPathParam 编码的 URL 路径参数。
 * 带 `b64_` 前缀（含 `/`、空格等特殊字符时前端按 URL-safe Base64 编码）才解码，
 * 否则原样返回（兼容普通字符 slug/id/langCode，以及旧客户端百分号编码经 Express 解码后的原始值）。
 */
export function decPathParam(seg: string): string {
  if (!seg.startsWith(B64_PREFIX))
    return seg
  const raw = seg.slice(B64_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(raw, 'base64').toString('utf8')
  }
  catch {
    return seg
  }
}
