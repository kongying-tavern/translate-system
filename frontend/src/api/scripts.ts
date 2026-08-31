import { apiGet } from './client'

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

export async function listScripts() {
  return await apiGet<ScriptInfo[]>('/scripts')
}

export async function getScript(id: string) {
  return await apiGet<ScriptInfo>(`/scripts/${id}`)
}

export async function downloadScript(id: string, platform: 'ps1' | 'sh') {
  return await apiGet<ScriptDownload>(`/scripts/${id}/download`, { params: { platform } })
}

export async function managerDownload(platform: 'win' | 'mac' | 'linux') {
  return await apiGet<{ available: boolean }>('/scripts/manager/download', { params: { platform } })
}
