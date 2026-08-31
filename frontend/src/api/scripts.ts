import client from './client'

export interface ScriptParam {
  shortName: string
  ps1Name: string
  shName: string
  type: 'string' | 'switch' | 'int' | 'enum' | 'subcommand'
  required: boolean
  default?: string | number | boolean | null
  enumValues?: string[]
  help: string
}

export interface ScriptPlatformFile {
  fileName: string
  sha256: string
  size: number
}

export interface ScriptSubcommand {
  name: string
  desc: string
  params: ScriptParam[]
  subcommands?: ScriptSubcommand[]
}

export interface ScriptInfo {
  id: string
  name: string
  description: string
  platforms: { ps1: ScriptPlatformFile, sh: ScriptPlatformFile }
  subcommands: ScriptSubcommand[]
}

export interface ScriptDownload {
  fileName: string
  content: string
  sha256: string
  platform: 'ps1' | 'sh'
}

export async function listScripts(): Promise<ScriptInfo[]> {
  const res = await client.get('/scripts')
  return res.data.data as ScriptInfo[]
}

export async function getScript(id: string): Promise<ScriptInfo> {
  const res = await client.get(`/scripts/${id}`)
  return res.data.data as ScriptInfo
}

export async function downloadScript(id: string, platform: 'ps1' | 'sh'): Promise<ScriptDownload> {
  const res = await client.get(`/scripts/${id}/download`, { params: { platform } })
  return res.data.data as ScriptDownload
}

export async function managerDownload(platform: 'win' | 'mac' | 'linux'): Promise<{ available: boolean }> {
  const res = await client.get('/scripts/manager/download', { params: { platform } })
  return res.data.data as { available: boolean }
}
