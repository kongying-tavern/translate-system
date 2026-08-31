import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'download_translations_multi',
  name: '下载翻译（合并文件）',
  description: '一次性导出全部语言到一个文件。',
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
        { shortName: 't', ps1Name: 'TemplateSlug', shName: 'template-slug', type: 'string', required: true, help: '导出模板 Slug (UUID 或 code)，在 Web 端创建后使用' },
        { shortName: 'o', ps1Name: 'OutputFile', shName: 'output-file', type: 'string', required: true, help: '输出文件路径' },
        { shortName: 'l', ps1Name: 'Languages', shName: 'languages', type: 'string', required: false, help: '过滤语言，逗号分隔，支持语言代码或代码别名，留空则导出所有语言' },
        { shortName: 'g', ps1Name: 'FilterTags', shName: 'filter-tags', type: 'string', required: false, help: '按标签过滤，逗号分隔，只导出含指定标签的条目' },
        { shortName: 'd', ps1Name: 'Delete', shName: 'delete', type: 'switch', required: false, default: false, help: '导出前删除已存在的输出文件' },
      ],
    },
  ],
}
