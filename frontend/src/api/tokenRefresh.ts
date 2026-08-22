import axios from 'axios'
import router from '@/router'
import { clearTokens, getAccessToken, getRefreshToken, getTokenExpires, setTokens } from '@/utils/token'

/** 提前刷新余量：过期前 30s 主动换新，避免边界期请求撞上过期 */
const REFRESH_LEAD_MS = 30_000

let isRefreshing = false
let failedQueue: Array<{ resolve: (value: unknown) => void, reject: (reason: unknown) => void }> = []
let timer: ReturnType<typeof setTimeout> | null = null
let storageListenerAttached = false

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error)
      prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

/**
 * 刷新 token（单飞：并发调用共享同一请求）。
 * 返回 ok=false 表示刷新彻底失败（已清除本地 token 并跳转登录）；
 * 若失败原因是另一标签页抢先旋转了同一 refreshToken，则直接采用本地新 token 视为成功。
 */
export async function refreshTokens(): Promise<{ ok: boolean, accessToken: string | null }> {
  const refreshTokenBefore = getRefreshToken()
  if (!refreshTokenBefore)
    return { ok: false, accessToken: null }

  if (isRefreshing) {
    try {
      const token = await new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
      return { ok: true, accessToken: token as string }
    }
    catch {
      return { ok: false, accessToken: null }
    }
  }

  isRefreshing = true
  try {
    const { data: res } = await axios.post('/api/v1/auth/refresh', { refreshToken: refreshTokenBefore })
    // 等待期间被其他标签页抢先旋转：丢弃本次结果，采用本地（新）token
    if (getRefreshToken() !== refreshTokenBefore) {
      processQueue(null, getAccessToken())
      scheduleProactiveRefresh()
      return { ok: true, accessToken: getAccessToken() }
    }
    setTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)
    processQueue(null, res.data.accessToken)
    scheduleProactiveRefresh()
    return { ok: true, accessToken: res.data.accessToken }
  }
  catch {
    // 失败但本地 refreshToken 已变化 → 其他标签页刷新成功，不登出
    if (getRefreshToken() !== refreshTokenBefore && getAccessToken()) {
      processQueue(null, getAccessToken())
      scheduleProactiveRefresh()
      return { ok: true, accessToken: getAccessToken() }
    }
    processQueue(new Error('登录已失效'), null)
    stopProactiveRefresh()
    clearTokens()
    void router.push('/auth/login')
    return { ok: false, accessToken: null }
  }
  finally {
    isRefreshing = false
  }
}

function reschedule() {
  if (timer)
    clearTimeout(timer)
  timer = null
  const expiresAt = getTokenExpires()
  if (!getRefreshToken() || !expiresAt)
    return
  const delay = Math.max(expiresAt - Date.now() - REFRESH_LEAD_MS, 5000)
  timer = setTimeout(async () => {
    await refreshTokens()
  }, delay)
}

/** 按本地过期时间安排主动刷新；其他标签页更新/清除 token 时经 storage 事件自动重排 */
export function scheduleProactiveRefresh() {
  if (!storageListenerAttached) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'access_token' || e.key === 'refresh_token' || e.key === 'token_expires')
        reschedule()
    })
    storageListenerAttached = true
  }
  reschedule()
}

export function stopProactiveRefresh() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
