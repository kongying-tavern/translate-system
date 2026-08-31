// META.ts 的共享类型。每个脚本包下的 META.ts 导出 meta: ScriptMeta，补全 README/ps1/sh 之外缺失的字段。
// 本文件与 META.ts 是手写维护的源（非生成产物），params 仅用于文档/展示，实际执行以 ps1/sh 自身参数为准。

export type ParamType = 'string' | 'switch' | 'int' | 'enum' | 'subcommand'

export interface ScriptParamMeta {
  /** 单字母短名（ps1/sh 一致），如 'e' */
  shortName: string
  /** ps1 PascalCase 长名，如 'Endpoint' */
  ps1Name: string
  /** sh kebab-case 长名，如 'endpoint' */
  shName: string
  /** 参数取值类型 */
  type: ParamType
  /** 是否必填 */
  required: boolean
  /** 默认值（可选） */
  default?: string | number | boolean | null
  /** type === 'enum' 时的可选值（可选） */
  enumValues?: string[]
  /** 帮助文本 */
  help: string
}

export interface SubcommandMeta {
  /** 子命令名；无子命令脚本（或承载全局参数）为 ''（空字符串） */
  name: string
  /** 子命令描述；name 为 '' 时可留空 */
  desc: string
  /** 该子命令（或全局层）的参数（文档用途；实际执行以 ps1/sh 为准） */
  params: ScriptParamMeta[]
  /** 递归的下一级子命令（可选）；仅顶层 ScriptMeta.subcommands 必选 */
  subcommands?: SubcommandMeta[]
}

export interface ScriptMeta {
  /** 脚本稳定标识（= 目录名），如 'import_translations' */
  id: string
  /** 显示名，如 '导入翻译' */
  name: string
  /** 脚本简介（一行描述） */
  description: string
  /** 根级子命令（至少一项）；无子命令脚本为 [{ name: '', params:[...] }] */
  subcommands: SubcommandMeta[]
}
