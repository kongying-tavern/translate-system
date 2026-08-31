import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'summarize_translations',
  name: '汇总翻译统计',
  subcommands: [
    {
      name: '',
      desc: '',
      params: [
        { shortName: 'e', ps1Name: 'Endpoint', shName: 'endpoint', type: 'string', required: true, help: '服务器地址，如 http://localhost:20080' },
        { shortName: 'k', ps1Name: 'ApiKey', shName: 'api-key', type: 'string', required: false, help: 'API Key (ak_xxx)，与 -AuthConfig 二选一' },
        { shortName: 's', ps1Name: 'ApiSecret', shName: 'api-secret', type: 'string', required: false, help: 'API Secret，与 -AuthConfig 二选一' },
        { shortName: 'a', ps1Name: 'AuthConfig', shName: 'auth-config', type: 'string', required: false, help: '鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）' },
        { shortName: 'p', ps1Name: 'ProjectSlug', shName: 'project-slug', type: 'string', required: true, help: '项目 Slug (UUID 或 code)' },
        { shortName: 'l', ps1Name: 'Languages', shName: 'languages', type: 'string', required: false, help: '过滤语言，逗号分隔，支持语言代码或代码别名，不传则全部' },
        { shortName: 'g', ps1Name: 'FilterTags', shName: 'filter-tags', type: 'string', required: false, help: '按标签过滤，逗号分隔，只统计含指定标签的条目' },
        { shortName: 'c', ps1Name: 'NoCodeAlias', shName: 'no-code-alias', type: 'switch', required: false, default: false, help: '输出的 langCode/文件名 使用语言代码而非代码别名（codeAlias）' },
        { shortName: 'n', ps1Name: 'NoNameAlias', shName: 'no-name-alias', type: 'switch', required: false, default: false, help: '输出的 langName 跳过语言别名（nameAlias），直接使用语言名称' },
        { shortName: 'f', ps1Name: 'InputFormat', shName: 'input-format', type: 'enum', required: false, enumValues: ['json', 'yaml', 'xml', 'properties', 'csv'], default: 'json', help: '输入文件类型: json, yaml, xml, properties, csv' },
        { shortName: 't', ps1Name: 'OutputFormat', shName: 'output-format', type: 'enum', required: false, enumValues: ['json', 'yaml', 'xml'], default: 'json', help: '输出文件类型: json, yaml, xml' },
        { shortName: 'i', ps1Name: 'InputDir', shName: 'input-dir', type: 'string', required: true, help: '包含翻译文件的目录' },
        { shortName: 'o', ps1Name: 'OutputFile', shName: 'output-file', type: 'string', required: false, help: '输出文件路径，默认 <InputDir>/summary.json' },
      ],
    },
  ],
}
