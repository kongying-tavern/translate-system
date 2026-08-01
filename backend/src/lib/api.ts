export interface ApiOk<T> {
  code: number
  message: string
  data: T
}

export interface ApiPage<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export function ok<T>(data: T): ApiOk<T> {
  return { code: 0, message: 'success', data }
}

export function okPage<T>(list: T[], total: number, page: number, pageSize: number): ApiOk<ApiPage<T>> {
  return { code: 0, message: 'success', data: { list, total, page, pageSize } }
}
