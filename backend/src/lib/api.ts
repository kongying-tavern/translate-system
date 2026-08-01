export interface ApiOk<T> {
  /** 状态码，0 表示成功 */
  code: number
  /** 提示信息 */
  message: string
  /** 响应数据 */
  data: T
}

export interface ApiPage<T> {
  /** 数据列表 */
  list: T[]
  /** 总数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

export function ok<T>(data: T): ApiOk<T> {
  return { code: 0, message: 'success', data }
}

export function okPage<T>(list: T[], total: number, page: number, pageSize: number): ApiOk<ApiPage<T>> {
  return { code: 0, message: 'success', data: { list, total, page, pageSize } }
}
