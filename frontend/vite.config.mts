import { resolve } from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME || '翻译管理平台'),
    },
    plugins: [
      vue(),
      vueJsx(),
      {
        name: 'openapi-swagger-ui-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if ((req.url || '').split('?')[0] === '/openapi/swagger-ui') {
              res.statusCode = 301
              res.setHeader('Location', '/openapi/swagger-ui/')
              res.end()
              return
            }
            next()
          })
        },
      },
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'cf-json-schema-viz',
      ],
    },
    server: {
      port: 3000,
      proxy: {
        '/api/v1': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/openapi/swagger-ui/': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/openapi\/swagger-ui/, '/api-docs'),
        },
        '/openapi/api.json': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/openapi\/api\.json/, '/api-docs/swagger.json'),
        },
        '/openapi/apikey.json': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/openapi\/apikey\.json/, '/api-docs/apikey.json'),
        },
      },
    },
  }
})
