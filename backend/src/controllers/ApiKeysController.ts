import type { ApiOk } from '../lib/api'
import type { AuthRequest } from '../middleware/auth'
import crypto from 'node:crypto'
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, Security, Tags } from '@tsoa/runtime'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/AppError'

export interface ApiKeyRow {
  id: string
  name: string
  apiKey: string
  enabled: boolean
  lastUsed: string | null
  createdAt: string
}

export interface ApiKeyCreated {
  id: string
  name: string
  apiKey: string
  secret: string
  createdAt: string
}

export interface CreateApiKeyBody {
  name: string
}

@Route('me')
@Tags('ApiKeys')
export class ApiKeysController extends Controller {
  /** 我的 API Key 列表 */
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

  /** 创建 API Key（返回一次性的 secret） */
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

  /** 启用/禁用 API Key */
  @Put('keys/{id}')
  @Security('auth')
  public async updateKey(@Request() req: AuthRequest, @Path() id: string, @Body() body: { enabled: boolean }): Promise<ApiOk<null>> {
    await prisma.apiKey.update({ where: { id, userId: req.userId! }, data: { enabled: body.enabled } })
    return ok(null)
  }

  /** 删除 API Key */
  @Delete('keys/{id}')
  @Security('auth')
  public async deleteKey(@Request() req: AuthRequest, @Path() id: string): Promise<ApiOk<null>> {
    await prisma.apiKey.delete({ where: { id, userId: req.userId! } })
    return ok(null)
  }
}
