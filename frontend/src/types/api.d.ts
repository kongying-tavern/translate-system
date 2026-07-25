export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageData<T = unknown> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
