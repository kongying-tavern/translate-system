import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { SystemRole } from '../constants/roles'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import * as authService from '../services/auth'
import { AppError } from '../utils/AppError'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface UserInfo {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  role: string
}

export interface UserRow {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
}

export interface RegisterBody {
  username: string
  email: string
  password: string
}

export interface LoginBody {
  account?: string
  email?: string
  password: string
}

export interface RefreshBody {
  refreshToken: string
}

export interface ChangePasswordBody {
  oldPassword: string
  newPassword: string
}

export interface CreateUserBody {
  username: string
  email: string
  password: string
  role?: string
}

export interface RoleBody {
  role: string
}

export interface PasswordBody {
  password: string
}

export interface UpdatedResult {
  updated: boolean
}

export interface DeletedResult {
  deleted: boolean
}

export interface RoleChanged {
  id: string
  username: string
  role: string
}

export interface CreatedUser {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
}

export interface UserBrief {
  id: string
  username: string
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /** 用户注册（首个用户自动成为超管） */
  @Post('register')
  public async register(@Body() body: RegisterBody): Promise<ApiOk<AuthTokens>> {
    if (!body.username || !body.email || !body.password)
      throw new AppError(ErrCode.InvalidParams, 'missing required fields')
    if (body.password.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    return ok(await authService.register(body.username, body.email, body.password))
  }

  /** 用户登录，支持用户名或邮箱 */
  @Post('login')
  public async login(@Body() body: LoginBody): Promise<ApiOk<AuthTokens>> {
    const account = body.account || body.email
    if (!account || !body.password)
      throw new AppError(ErrCode.InvalidParams, '请输入用户名/邮箱和密码')
    return ok(await authService.login(account, body.password))
  }

  /** 刷新 token */
  @Post('refresh')
  public async refresh(@Body() body: RefreshBody): Promise<ApiOk<AuthTokens>> {
    if (!body.refreshToken)
      throw new AppError(ErrCode.InvalidParams, 'missing refreshToken')
    return ok(await authService.refresh(body.refreshToken))
  }

  /** 获取当前用户信息 */
  @Get('me')
  @Security('auth')
  public async me(@Request() req: AuthRequest): Promise<ApiOk<UserInfo>> {
    return ok(await authService.getUser(req.userId!))
  }

  /** 修改自己的密码 */
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

  /** 用户列表（admin+） */
  @Get('users')
  @Security('admin')
  public async listUsers(): Promise<ApiOk<UserRow[]>> {
    return ok(await authService.listUsers())
  }

  /** 修改用户角色（admin+） */
  @Put('users/{id}/role')
  @Security('admin')
  public async updateUserRole(@Request() req: AuthRequest, @Path() id: string, @Body() body: RoleBody): Promise<ApiOk<RoleChanged>> {
    return ok(await authService.updateUserRole(req.userId!, id, body.role))
  }

  /** 创建用户（admin+） */
  @Post('users')
  @Security('admin')
  public async createUser(@Request() req: AuthRequest, @Body() body: CreateUserBody): Promise<ApiOk<CreatedUser>> {
    if (!body.username || !body.email || !body.password)
      throw new AppError(ErrCode.InvalidParams, '缺少必填字段')
    if (body.password.length < 6)
      throw new AppError(ErrCode.InvalidParams, '密码至少6位')
    return ok(await authService.createUser(body.username, body.email, body.password, body.role || SystemRole.User, req.userRole!))
  }

  /** 删除用户（admin+） */
  @Delete('users/{id}')
  @Security('admin')
  public async deleteUser(@Request() req: AuthRequest, @Path() id: string): Promise<ApiOk<DeletedResult>> {
    await authService.deleteUser(req.userId!, id)
    return ok({ deleted: true })
  }

  /** 重置用户密码（admin+） */
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
