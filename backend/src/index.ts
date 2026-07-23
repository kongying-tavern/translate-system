import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './docs/swagger'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { languageRoutes } from './routes/languages'
import { translationRoutes } from './routes/translations'
import { layoutRoutes } from './routes/layouts'
import { exportRoutes } from './routes/exports'
import { apiKeyRoutes } from './routes/apikeys'
import { apiKeyAuth } from './middleware/apikey'
import { errorHandler } from './middleware/errorHandler'

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json())

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// API Key management (JWT only, no API key proxy)
app.use('/api/v1/apikey', apiKeyRoutes)

// JWT routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/projects', projectRoutes)
app.use('/api/v1/languages', languageRoutes)
app.use('/api/v1/projects', translationRoutes)
app.use('/api/v1/projects', layoutRoutes)
app.use('/api/v1/projects', exportRoutes)

// API Key proxy: whitelist of exposed routes
const APIKEY_WHITELIST = [
  { method: 'GET', path: /^\/projects\/[^/]+\/translations$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/translations\/tags\/list$/ },
  { method: 'GET', path: /^\/projects\/[^/]+\/languages$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/exports\/preview$/ },
  { method: 'POST', path: /^\/projects\/[^/]+\/exports\/generate$/ },
]

const apikeyProxy = express.Router()
apikeyProxy.use(apiKeyAuth())
// Whitelist guard
apikeyProxy.use((req: any, res: any, next: any) => {
  const allowed = APIKEY_WHITELIST.some(w =>
    w.method === req.method && w.path.test(req.path)
  )
  if (!allowed) return res.status(403).json({ code: 1002, message: '接口不在白名单', data: null })
  next()
})
apikeyProxy.use('/projects', projectRoutes)
apikeyProxy.use('/projects', translationRoutes)
apikeyProxy.use('/projects', exportRoutes)
app.use('/api/v1/apikey', apikeyProxy)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT)
  console.log('Swagger docs: http://localhost:' + PORT + '/api-docs')
})
