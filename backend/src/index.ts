import type { NextFunction, Request, Response } from 'express'
import process from 'node:process'
import cors from 'cors'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { RegisterRoutes } from './docs/routes'
import { swaggerSpec } from './docs/swagger'
import { APIKEY_WHITELIST } from './lib/apikey-whitelist'
import { apiKeyAuth } from './middleware/apikey'
import { errorHandler } from './middleware/errorHandler'
import { docsRoutes } from './routes/docs'

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json())

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// JWT routes (tsoa controllers)
const jwtRouter = express.Router()
RegisterRoutes(jwtRouter)
app.use('/api/v1', jwtRouter)

// API doc summary (JWT required)
app.use('/api/v1/docs', docsRoutes)

// API Key proxy: same tsoa routes behind apiKeyAuth + whitelist guard
// 管理接口（/me/keys）不在代理上使用，前端走 JWT 路由 /api/v1/me/keys
const apikeyProxy = express.Router()
apikeyProxy.use(apiKeyAuth())
apikeyProxy.use((req: Request, res: Response, next: NextFunction) => {
  const allowed = APIKEY_WHITELIST.some(w =>
    w.method === req.method && w.path.test(req.path),
  )
  if (!allowed)
    return res.status(403).json({ code: 1002, message: '接口不在白名单', data: null })
  next()
})
RegisterRoutes(apikeyProxy)
app.use('/api/v1/apikey', apikeyProxy)

app.use(errorHandler)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`)
})
