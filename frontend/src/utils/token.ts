const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const EXPIRES_KEY = 'token_expires'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
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
