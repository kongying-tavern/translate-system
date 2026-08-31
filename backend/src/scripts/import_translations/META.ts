import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'import_translations',
  name: '导入翻译',
  description: '将翻译内容（translation_value）批量导入指定语言。支持 JSON / CSV / YAML / XML / Properties 格式，需明确指定格式类型。',
  subcommands: [
    {
      name: '',
      desc: '',
      params: [
        { shortName: 'e', ps1Name: 'Endpoint', shName: 'endpoint', type: 'string', required: true, help: '服务器地址，如 http://localhost:20080' },
        { shortName: 'k', ps1Name: 'ApiKey', shName: 'api-key', type: 'string', required: false, help: 'API Key (ak_xxx)，与 -AuthConfig 二选一' },
        { shortName: 's', ps1Name: 'ApiSecret', shName: 'api-secret', type: 'string', required: false, help: 'API Secret，与 -AuthConfig 二选一' },
        { shortName: 'a', ps1Name: 'AuthConfig', shName: 'auth-config', type: 'string', required: false, help: '鉴权信息文件路径（JSON 格式，包含 apiKey 和 apiSecret）' },
        { shortName: 'p', ps1Name: 'ProjectSlug', shName: 'project-slug', type: 'string', required: true, help: '项目 Slug (UUID 或 code)' },
        { shortName: 't', ps1Name: 'FormatType', shName: 'format-type', type: 'enum', required: true, enumValues: ['json', 'csv', 'yaml', 'xml', 'properties'], help: '格式类型：json / csv / yaml / xml / properties' },
        { shortName: 'l', ps1Name: 'Language', shName: 'language', type: 'string', required: true, help: '目标语言代码（如 zh-Hans，支持代码别名）' },
        { shortName: 'f', ps1Name: 'File', shName: 'file', type: 'string', required: true, help: '数据文件路径' },
        { shortName: 'o', ps1Name: 'Overwrite', shName: 'overwrite', type: 'switch', required: false, default: false, help: '覆盖已有译文（默认不覆盖）' },
        { shortName: 'n', ps1Name: 'NoAutoCreate', shName: 'no-auto-create', type: 'switch', required: false, default: false, help: '不自动补全新条目（默认自动创建）' },
      ],
    },
  ],
}
