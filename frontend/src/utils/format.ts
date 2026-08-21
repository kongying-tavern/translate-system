export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** 大数字千分位显示 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n))
    return '0'
  return n.toLocaleString('zh-CN')
}
