import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import crypto from 'node:crypto'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { decodePathParams } from '../middleware/decodePathParams'
import { AppError } from '../utils/AppError'

export interface ApiKeyRow {
  /** 密钥 ID */
  id: string
  /** 密钥名称 */
  name: string
  /** 密钥标识 */
  apiKey: string
  /** 是否启用 */
  enabled: boolean
  /** 最后使用时间 */
  lastUsed: string | null
  /** 创建时间 */
  createdAt: string
}

export interface ApiKeyCreated {
  /** 密钥 ID */
  id: string
  /** 密钥名称 */
  name: string
  /** 密钥标识 */
  apiKey: string
  /** 一次性完整密钥 */
  secret: string
  /** 创建时间 */
  createdAt: string
}

export interface CreateApiKeyBody {
  /**
   * 密钥名称
   * @example "CI 自动导出"
   */
  name: string
}

export interface UpdateApiKeyBody {
  /** 是否启用 */
  enabled: boolean
}

@Route('me')
@Tags('ApiKeys')
@Middlewares(decodePathParams)
export class ApiKeysController extends Controller {
  /**
   * 我的 API Key 列表
   * @param req 请求对象
   * @summary 我的 API Key 列表
   */
  @Get('keys')
  @Security('auth')
  public async listKeys(@Request() req: AuthRequest): Promise<ApiOk<ApiKeyRow[]>> {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId! },
      select: { id: true, name: true, apiKey: true, enabled: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return ok(keys as unknown as ApiKeyRow[])
  }

  /**
   * 创建 API Key（返回一次性的 secret）
   * @param req 请求对象
   * @param body 请求体
   * @summary 创建 API Key
   */
  @Post('keys')
  @Security('auth')
  public async createKey(@Request() req: AuthRequest, @Body() body: CreateApiKeyBody): Promise<ApiOk<ApiKeyCreated>> {
    if (!body.name)
      throw new AppError(ErrCode.InvalidParams, 'name is required')
    const apiKey = `ak_${crypto.randomBytes(16).toString('hex')}`
    const rawSecret = crypto.randomBytes(24).toString('hex')
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex')
    const k = await prisma.apiKey.create({ data: { userId: req.userId!, name: body.name, apiKey, secret: secretHash } })
    return ok({ id: k.id, name: k.name, apiKey: k.apiKey, secret: rawSecret, createdAt: k.createdAt.toISOString() })
  }

  /**
   * 启用/禁用 API Key
   * @param req 请求对象
   * @param id 密钥 ID
   * @param body 请求体
   * @summary 启用/禁用 API Key
   */
  @Put('keys/{id}')
  @Security('auth')
  public async updateKey(@Request() req: AuthRequest, @Path() id: string, @Body() body: UpdateApiKeyBody): Promise<ApiOk<null>> {
    await prisma.apiKey.update({ where: { id, userId: req.userId! }, data: { enabled: body.enabled } })
    return ok(null)
  }

  /**
   * 删除 API Key
   * @param req 请求对象
   * @param id 密钥 ID
   * @summary 删除 API Key
   */
  @Delete('keys/{id}')
  @Security('auth')
  public async deleteKey(@Request() req: AuthRequest, @Path() id: string): Promise<ApiOk<null>> {
    await prisma.apiKey.delete({ where: { id, userId: req.userId! } })
    return ok(null)
  }
}
