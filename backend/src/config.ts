import dotenv from 'dotenv'
dotenv.config()

export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtAccessTTL: parseInt(process.env.JWT_ACCESS_TTL || '900'),
  jwtRefreshTTL: parseInt(process.env.JWT_REFRESH_TTL || '604800'),
  port: parseInt(process.env.PORT || '8080'),
}
