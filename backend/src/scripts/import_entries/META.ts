import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'import_entries',
  name: '导入条目',
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
        { shortName: 'f', ps1Name: 'File', shName: 'file', type: 'string', required: true, help: '数据文件路径（JSON / CSV / YAML / XML 格式）' },
        { shortName: 'o', ps1Name: 'Overwrite', shName: 'overwrite', type: 'switch', required: false, default: false, help: '覆盖已有条目（默认不覆盖，只新增）' },
      ],
    },
  ],
}
