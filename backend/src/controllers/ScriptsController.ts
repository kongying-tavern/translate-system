import type { ApiOk } from '../lib/api'
import type { ScriptDownload, ScriptInfo, ScriptPlatform } from '../services/scripts'
import { Controller, Get, Path, Query, Route, Tags } from '@tsoa/runtime'
import { ok } from '../lib/api'
import { ErrCode } from '../lib/errors'
import { getScript, getScriptDownload, listScripts } from '../services/scripts'
import { AppError } from '../utils/AppError'

@Tags('脚本')
@Route('scripts')
export class ScriptsController extends Controller {
  /** 列出全部脚本（含元数据、参数、指纹）；免授权，开放给所有使用者 */
  @Get()
  public async list(): Promise<ApiOk<ScriptInfo[]>> {
    return ok(listScripts())
  }

  /** 获取单个脚本元数据 */
  @Get('{id}')
  public async detail(@Path() id: string): Promise<ApiOk<ScriptInfo> | null> {
    const info = getScript(decodeURIComponent(id))
    if (!info)
      return null
    return ok(info)
  }

  /** 下载脚本内容（返回文本，由工具自行写入文件） */
  @Get('{id}/download')
  public async download(
    @Path() id: string,
    @Query() platform: ScriptPlatform,
  ): Promise<ApiOk<ScriptDownload>> {
    const id2 = decodeURIComponent(id)
    if (platform !== 'ps1' && platform !== 'sh')
      throw new AppError(ErrCode.InvalidParams, 'platform 必须为 ps1 或 sh')
    const dl = getScriptDownload(id2, platform)
    if (!dl)
      throw new AppError(ErrCode.NotFound, '脚本不存在')
    return ok(dl)
  }

  /** 下载脚本管理器（占位：尚未提供） */
  @Get('manager/download')
  public async managerDownload(
    @Query() _platform: 'win' | 'mac' | 'linux',
  ): Promise<ApiOk<{ available: boolean }>> {
    return ok({ available: false })
  }
}
