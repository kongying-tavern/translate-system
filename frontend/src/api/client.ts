import axios from 'axios'
import router from '@/router'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/utils/token'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (value: unknown) => void, reject: (reason: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error)
      prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token)
    config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        router.push('/auth/login')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token: unknown) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return client(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data: res } = await axios.post('/api/v1/auth/refresh', { refreshToken })
        setTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)
        processQueue(null, res.data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`
        return client(originalRequest)
      }
      catch (err) {
        processQueue(err, null)
        clearTokens()
        router.push('/auth/login')
        return Promise.reject(err)
      }
      finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default client
