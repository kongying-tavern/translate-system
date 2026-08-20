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
import { buildApiKeyOpenApiSpec } from './services/docs'

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json({ limit: '200mb' }))

// OpenAPI 文档暴露策略：
// - /api-docs/apikey.json 永远暴露（外部 API Key 调用方、前端「开放接口说明」页 /api-doc 与 Swagger UI「API Key 开放接口」标签依赖）
// - 其余由两个开关显式控制，设 true 才暴露（默认不暴露）：
//   - OPENAPI_SWAGGER 控制 Swagger UI 页面
//   - OPENAPI_API_JSON 控制 swagger.json（JWT 全量原始文档）
const exposeSwaggerUI = process.env.OPENAPI_SWAGGER === 'true'
const exposeApiJson = process.env.OPENAPI_API_JSON === 'true'

app.get('/api-docs/apikey.json', (_req: Request, res: Response) => {
  res.json(buildApiKeyOpenApiSpec())
})
if (exposeApiJson) {
  app.get('/api-docs/swagger.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec)
  })
}
if (exposeSwaggerUI) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        urls: [
          ...(exposeApiJson ? [{ url: './swagger.json', name: 'JWT 接口' }] : []),
          { url: './apikey.json', name: 'API Key 开放接口' },
        ],
      },
    }),
  )
}

// JWT routes (tsoa controllers)
const jwtRouter = express.Router()
RegisterRoutes(jwtRouter)
app.use('/api/v1', jwtRouter)

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
