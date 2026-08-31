import type { ScriptParamMeta, SubcommandMeta } from '../scripts/scripts-types'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { meta as deployMeta } from '../scripts/deploy/META'
import { meta as downloadMultiMeta } from '../scripts/download_translations_multi/META'
import { meta as downloadSingleMeta } from '../scripts/download_translations_single/META'
import { meta as folderLockMeta } from '../scripts/folder_lock/META'
import { meta as importEntriesMeta } from '../scripts/import_entries/META'
import { meta as importTranslationsMeta } from '../scripts/import_translations/META'
import { meta as summarizeMeta } from '../scripts/summarize_translations/META'

// 脚本包根目录：位于 backend/src/scripts/（dev 与 docker 均以 tsx 运行 src，__dirname 指向 src/services）
export const SCRIPTS_ROOT = path.resolve(__dirname, '..', 'scripts')

export interface ScriptParam {
  /** 单字母短名（ps1/sh 一致） */
  shortName: string
  /** ps1 PascalCase 长名 */
  ps1Name: string
  /** sh kebab-case 长名 */
  shName: string
  /** 取值类型 */
  type: 'string' | 'switch' | 'int' | 'enum' | 'subcommand'
  /** 是否必填 */
  required: boolean
  /** 默认值 */
  default?: string | number | boolean | null
  /** enum 可选值 */
  enumValues?: string[]
  /** 帮助文本 */
  help: string
}

export interface SubcommandInfo {
  /** 子命令名；无子命令（全局层）为 '' */
  name: string
  /** 子命令描述；name 为 '' 时可留空 */
  desc: string
  /** 该子命令的参数 */
  params: ScriptParam[]
  /** 递归的下一级子命令（可选） */
  subcommands?: SubcommandInfo[]
}

export interface ScriptPlatformFile {
  /** 文件名，如 SCRIPT.ps1 */
  fileName: string
  /** 文件内容 sha256 指纹（运行时现算） */
  sha256: string
  /** 文件字节数 */
  size: number
}

export interface ScriptInfo {
  /** 脚本稳定标识（= 目录名） */
  id: string
  /** 显示名 */
  name: string
  /** 脚本说明（来自 README.md） */
  description: string
  /** 两个平台的脚本文件（内容 + 指纹） */
  platforms: {
    ps1: ScriptPlatformFile
    sh: ScriptPlatformFile
  }
  /** 子命令定义（来自 META.ts，文档用途；无子命令脚本为 [{ name:'', params:[...] }]） */
  subcommands: SubcommandInfo[]
}

interface ScriptSource {
  id: string
  name: string
  subcommands: SubcommandMeta[]
  readmeFile: string
  ps1File: string
  shFile: string
}

const SOURCES: ScriptSource[] = [
  { ...deployMeta, readmeFile: 'deploy/README.md', ps1File: 'deploy/SCRIPT.ps1', shFile: 'deploy/SCRIPT.sh' },
  { ...folderLockMeta, readmeFile: 'folder_lock/README.md', ps1File: 'folder_lock/SCRIPT.ps1', shFile: 'folder_lock/SCRIPT.sh' },
  { ...importEntriesMeta, readmeFile: 'import_entries/README.md', ps1File: 'import_entries/SCRIPT.ps1', shFile: 'import_entries/SCRIPT.sh' },
  { ...downloadSingleMeta, readmeFile: 'download_translations_single/README.md', ps1File: 'download_translations_single/SCRIPT.ps1', shFile: 'download_translations_single/SCRIPT.sh' },
  { ...downloadMultiMeta, readmeFile: 'download_translations_multi/README.md', ps1File: 'download_translations_multi/SCRIPT.ps1', shFile: 'download_translations_multi/SCRIPT.sh' },
  { ...importTranslationsMeta, readmeFile: 'import_translations/README.md', ps1File: 'import_translations/SCRIPT.ps1', shFile: 'import_translations/SCRIPT.sh' },
  { ...summarizeMeta, readmeFile: 'summarize_translations/README.md', ps1File: 'summarize_translations/SCRIPT.ps1', shFile: 'summarize_translations/SCRIPT.sh' },
]

function fileStat(rel: string): ScriptPlatformFile {
  const abs = path.join(SCRIPTS_ROOT, rel)
  const content = fs.readFileSync(abs)
  const sha256 = createHash('sha256').update(content).digest('hex')
  return { fileName: path.basename(rel), sha256, size: content.length }
}

function description(rel: string): string {
  const abs = path.join(SCRIPTS_ROOT, rel)
  // README 首行标题后的首段描述
  const text = fs.readFileSync(abs, 'utf-8')
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).join(' ') || text.trim()
}

function toScriptParam(p: ScriptParamMeta): ScriptParam {
  const out: ScriptParam = {
    shortName: p.shortName,
    ps1Name: p.ps1Name,
    shName: p.shName,
    type: p.type,
    required: p.required,
    help: p.help,
  }
  if (p.default !== undefined)
    out.default = p.default
  if (p.enumValues)
    out.enumValues = p.enumValues
  return out
}

function toSubcommand(sc: SubcommandMeta): SubcommandInfo {
  return {
    name: sc.name,
    desc: sc.desc,
    params: sc.params.map(toScriptParam),
    subcommands: (sc.subcommands ?? []).map(toSubcommand),
  }
}

export function listScripts(): ScriptInfo[] {
  return SOURCES.map(s => ({
    id: s.id,
    name: s.name,
    description: description(s.readmeFile),
    platforms: { ps1: fileStat(s.ps1File), sh: fileStat(s.shFile) },
    subcommands: s.subcommands.map(toSubcommand),
  }))
}

export function getScript(id: string): ScriptInfo | undefined {
  return listScripts().find(s => s.id === id)
}

export type ScriptPlatform = 'ps1' | 'sh'

export function getScriptFile(id: string, platform: ScriptPlatform): { relativePath: string } | undefined {
  const src = SOURCES.find(s => s.id === id)
  if (!src)
    return undefined
  return { relativePath: platform === 'ps1' ? src.ps1File : src.shFile }
}
export interface ScriptDownload {
  /** 脚本文件名，如 SCRIPT.ps1 */
  fileName: string
  /** 脚本原文内容（UTF-8 文本） */
  content: string
  /** 内容 sha256 指纹 */
  sha256: string
  /** 平台 */
  platform: ScriptPlatform
}

/** 获取某脚本指定平台的下载内容；脚本不存在时返回 undefined */
export function getScriptDownload(id: string, platform: ScriptPlatform): ScriptDownload | undefined {
  const file = getScriptFile(id, platform)
  if (!file)
    return undefined
  const abs = path.join(SCRIPTS_ROOT, file.relativePath)
  const buf = fs.readFileSync(abs)
  const sha256 = createHash('sha256').update(buf).digest('hex')
  return {
    fileName: path.basename(abs),
    content: buf.toString('utf-8'),
    sha256,
    platform,
  }
}
