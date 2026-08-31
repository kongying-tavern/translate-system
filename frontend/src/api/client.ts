import axios from 'axios'
import router from '@/router'
import { clearTokens, getAccessToken, getRefreshToken } from '@/utils/token'
import { refreshTokens } from './tokenRefresh'

/** 后端统一响应结构 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token)
    config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => {
    const body = response.data as { code?: number, message?: string } | null
    if (body && typeof body.code === 'number' && body.code !== 0) {
      const err = new Error(body.message || '请求失败') as Error & { response: unknown }
      err.response = response
      return Promise.reject(err)
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    // access token 过期：统一走 tokenRefresh 单飞刷新（过期前 30s 的主动刷新通常已先行完成）
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      if (!getRefreshToken()) {
        clearTokens()
        void router.push('/auth/login')
        return Promise.reject(error)
      }
      const { ok, accessToken } = await refreshTokens()
      if (!ok || !accessToken)
        return Promise.reject(error)
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return client(originalRequest)
    }
    return Promise.reject(error)
  },
)

export default client

/** 带类型的 GET 请求，自动解包 ApiResponse<T> */
export async function apiGet<T>(url: string, config?: Parameters<typeof client.get>[1]): Promise<T> {
  const res = await client.get<ApiResponse<T>>(url, config)
  return res.data.data
}
