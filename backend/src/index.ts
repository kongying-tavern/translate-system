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
import { errorHandler } from './middleware/errorHandler'

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json())

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/projects', projectRoutes)
app.use('/api/v1/languages', languageRoutes)
app.use('/api/v1/projects', translationRoutes)
app.use('/api/v1/projects', layoutRoutes)
app.use('/api/v1/projects', exportRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`)
})
