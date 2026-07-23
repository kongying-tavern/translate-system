export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageData<T = any> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
