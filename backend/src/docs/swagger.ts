import swaggerJsdoc from 'swagger-jsdoc'

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: '翻译后台管理系统 API',
      version: '1.0.0',
      description: '翻译管理后台的 RESTful API 接口文档',
    },
    servers: [{ url: 'http://localhost:8080', description: '本地开发' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            sourceLanguage: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Translation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            languageCode: { type: 'string' },
            translationKey: { type: 'string' },
            sourceText: { type: 'string' },
            translatedText: { type: 'string' },
            context: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            isReviewed: { type: 'boolean' },
          },
        },
        BaseLanguage: {
          type: 'object',
          properties: {
            languageCode: { type: 'string' },
            englishName: { type: 'string' },
            nativeName: { type: 'string', nullable: true },
            iso6391: { type: 'string', nullable: true },
            region: { type: 'string', nullable: true },
          },
        },
        LayoutTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            config: { type: 'object' },
            isDefault: { type: 'boolean' },
          },
        },
        LayoutConfig: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            name: { type: 'string' },
            templateSlug: { type: 'string', nullable: true },
            overrideConfig: { type: 'object' },
          },
        },
        ExportTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            formatType: { type: 'string' },
            config: { type: 'object' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
            data: {},
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
})
