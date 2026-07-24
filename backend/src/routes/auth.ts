import { Router } from 'express'
import * as authService from '../services/auth'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/role'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const authRoutes = Router()

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: 用户注册
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, minLength: 3 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: 成功, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
authRoutes.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password) return error(res, ErrCode.InvalidParams, 'missing required fields')
    const result = await authService.register(username, email, password)
    success(res, result)
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message || 'register failed') }
})

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 用户登录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: 返回 JWT token }
 */
authRoutes.post('/login', async (req, res, next) => {
  try {
    const { account, email, password } = req.body
    const loginAccount = account || email
    if (!loginAccount || !password) return error(res, ErrCode.InvalidParams, '请输入用户名/邮箱和密码')
    const result = await authService.login(loginAccount, password)
    success(res, result)
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message || 'login failed') }
})

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 刷新 token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: 返回新的 token 对 }
 */
authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return error(res, ErrCode.InvalidParams, 'missing refreshToken')
    const result = await authService.refresh(refreshToken)
    success(res, result)
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message || 'refresh failed') }
})

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 获取当前用户信息
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 返回用户信息 }
 */
authRoutes.get('/me', authMiddleware, async (req: any, res, next) => {
  try { success(res, await authService.getUser(req.userId)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message || 'failed') }
})

authRoutes.put('/me/password', authMiddleware, async (req: any, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return error(res, ErrCode.InvalidParams, '缺少密码')
    await authService.changeOwnPassword(req.userId, oldPassword, newPassword)
    success(res, { updated: true })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

// ── User management (admin+) ──
authRoutes.get('/users', authMiddleware, requireRole('admin'), async (req: any, res, next) => {
  try { success(res, await authService.listUsers()) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

authRoutes.put('/users/:id/role', authMiddleware, requireRole('admin'), async (req: any, res, next) => {
  try { success(res, await authService.updateUserRole(req.userId, req.params.id, req.body.role)) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

authRoutes.post('/users', authMiddleware, requireRole('admin'), async (req: any, res, next) => {
  try {
    const { username, email, password, role } = req.body
    if (!username || !email || !password) return error(res, ErrCode.InvalidParams, '缺少必填字段')
    success(res, await authService.createUser(username, email, password, role || 'member'))
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

authRoutes.delete('/users/:id', authMiddleware, requireRole('admin'), async (req: any, res, next) => {
  try { await authService.deleteUser(req.userId, req.params.id); success(res, { deleted: true }) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})

authRoutes.put('/users/:id/password', authMiddleware, requireRole('admin'), async (req: any, res, next) => {
  try {
    if (!req.body.password) return error(res, ErrCode.InvalidParams, '密码不能为空')
    await authService.changeUserPassword(req.userId, req.params.id, req.body.password)
    success(res, { updated: true })
  } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
