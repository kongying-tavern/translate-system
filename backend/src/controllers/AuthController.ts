import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { SystemRole } from '../constants/roles'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import * as authService from '../services/auth'
import { AppError } from '../utils/AppError'

export interface AuthTokens {
  /** 访问令牌 */
  accessToken: string
  /** 刷新令牌 */
  refreshToken: string
  /** 过期秒数 */
  expiresIn: number
}

export interface UserInfo {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email: string
  /** 头像地址 */
  avatarUrl: string | null
  /** 系统角色 */
  role: string
}

export interface UserRow {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email: string
  /** 系统角色 */
  role: string
  /** 创建时间 */
  createdAt: Date
}

export interface RegisterBody {
  /**
   * 用户名
   * @example "demo"
   */
  username: string
  /**
   * 邮箱
   * @example "demo@example.com"
   */
  email: string
  /**
   * 密码（至少 6 位）
   * @example "123456"
   */
  password: string
}

export interface LoginBody {
  /**
   * 用户名（与 email 二选一）
   * @example "demo"
   */
  account?: string
  /**
   * 邮箱（与 account 二选一）
   * @example "demo@example.com"
   */
  email?: string
  /**
   * 密码
   * @example "123456"
   */
  password: string
}

export interface RefreshBody {
  /** 刷新令牌 */
  refreshToken: string
}

export interface ChangePasswordBody {
  /** 旧密码 */
  oldPassword: string
  /** 新密码 */
  newPassword: string
}

export interface CreateUserBody {
  /**
   * 用户名
   * @example "demo"
   */
  username: string
  /**
   * 邮箱
   * @example "demo@example.com"
   */
  email: string
  /**
   * 密码（至少 6 位）
   * @example "123456"
   */
  password: string
  /**
   * 系统角色（user/admin，admin 不能创建/提升到 super_admin）
   * @example "user"
   */
  role?: string
}

export interface RoleBody {
  /** 系统角色 */
  role: string
}

export interface PasswordBody {
  /** 新密码 */
  password: string
}

export interface UpdatedResult {
  /** 是否已更新 */
  updated: boolean
}

export interface DeletedResult {
  /** 是否已删除 */
  deleted: boolean
}

export interface RoleChanged {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
  /** 新系统角色 */
  role: string
}

export interface CreatedUser {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email: string
  /** 系统角色 */
  role: string
  /** 创建时间 */
  createdAt: Date
}

export interface UserBrief {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /**
   * 用户注册（首个用户自动成为超管）
   * @param body 请求体
   * @summary 用户注册
   */
  @Post('register')
  public async register(@Body() body: RegisterBody): Promise<ApiOk<AuthTokens>> {
    if (!body.username || !body.email || !body.password)
      throw new AppError(ErrCode.InvalidParams, 'missing required fields')
    if (body.password.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    return ok(await authService.register(body.username, body.email, body.password))
  }

  /**
   * 用户登录，支持用户名或邮箱
   * @param body 请求体
   * @summary 用户登录
   */
  @Post('login')
  public async login(@Body() body: LoginBody): Promise<ApiOk<AuthTokens>> {
    const account = body.account || body.email
    if (!account || !body.password)
      throw new AppError(ErrCode.InvalidParams, '请输入用户名/邮箱和密码')
    return ok(await authService.login(account, body.password))
  }

  /**
   * 刷新 token
   * @param body 请求体
   * @summary 刷新 token
   */
  @Post('refresh')
  public async refresh(@Body() body: RefreshBody): Promise<ApiOk<AuthTokens>> {
    if (!body.refreshToken)
      throw new AppError(ErrCode.InvalidParams, 'missing refreshToken')
    return ok(await authService.refresh(body.refreshToken))
  }

  /**
   * 获取当前用户信息
   * @param req 请求对象
   * @summary 获取当前用户信息
   */
  @Get('me')
  @Security('auth')
  public async me(@Request() req: AuthRequest): Promise<ApiOk<UserInfo>> {
    return ok(await authService.getUser(req.userId!))
  }

  /**
   * 修改自己的密码
   * @param req 请求对象
   * @param body 请求体
   * @summary 修改自己的密码
   */
  @Put('me/password')
  @Security('auth')
  public async changeOwnPassword(@Request() req: AuthRequest, @Body() body: ChangePasswordBody): Promise<ApiOk<UpdatedResult>> {
    if (!body.oldPassword || !body.newPassword)
      throw new AppError(ErrCode.InvalidParams, '缺少密码')
    if (body.newPassword.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    await authService.changeOwnPassword(req.userId!, body.oldPassword, body.newPassword)
    return ok({ updated: true })
  }

  /**
   * 用户列表（admin+）
   * @summary 用户列表
   */
  @Get('users')
  @Security('admin')
  public async listUsers(): Promise<ApiOk<UserRow[]>> {
    return ok(await authService.listUsers())
  }

  /**
   * 修改用户角色（admin+）
   * @param req 请求对象
   * @param id 用户 ID
   * @param body 请求体
   * @summary 修改用户角色
   */
  @Put('users/{id}/role')
  @Security('admin')
  public async updateUserRole(@Request() req: AuthRequest, @Path() id: string, @Body() body: RoleBody): Promise<ApiOk<RoleChanged>> {
    return ok(await authService.updateUserRole(req.userId!, id, body.role))
  }

  /**
   * 创建用户（admin+）
   * @param req 请求对象
   * @param body 请求体
   * @summary 创建用户
   */
  @Post('users')
  @Security('admin')
  public async createUser(@Request() req: AuthRequest, @Body() body: CreateUserBody): Promise<ApiOk<CreatedUser>> {
    if (!body.username || !body.email || !body.password)
      throw new AppError(ErrCode.InvalidParams, '缺少必填字段')
    if (body.password.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    return ok(await authService.createUser(body.username, body.email, body.password, body.role || SystemRole.User, req.userRole!))
  }

  /**
   * 删除用户（admin+）
   * @param req 请求对象
   * @param id 用户 ID
   * @summary 删除用户
   */
  @Delete('users/{id}')
  @Security('admin')
  public async deleteUser(@Request() req: AuthRequest, @Path() id: string): Promise<ApiOk<DeletedResult>> {
    await authService.deleteUser(req.userId!, id)
    return ok({ deleted: true })
  }

  /**
   * 重置用户密码（admin+）
   * @param req 请求对象
   * @param id 用户 ID
   * @param body 请求体
   * @summary 重置用户密码
   */
  @Put('users/{id}/password')
  @Security('admin')
  public async changeUserPassword(@Request() req: AuthRequest, @Path() id: string, @Body() body: PasswordBody): Promise<ApiOk<UserBrief>> {
    if (!body.password)
      throw new AppError(ErrCode.InvalidParams, '密码不能为空')
    if (body.password.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    return ok(await authService.changeUserPassword(req.userId!, id, body.password))
  }
}
