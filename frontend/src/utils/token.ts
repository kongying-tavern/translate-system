const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const EXPIRES_KEY = 'token_expires'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

/** 过期时刻的本地毫秒时间戳（未存储时返回 null） */
export function getTokenExpires(): number | null {
  const raw = localStorage.getItem(EXPIRES_KEY)
  if (!raw)
    return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.setItem(EXPIRES_KEY, String(expiresIn * 1000))
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}
