import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'download_translations_single',
  name: '下载翻译（单语言文件）',
  description: '从服务器导出翻译文件，每语言一个单独文件。',
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
        { shortName: 'o', ps1Name: 'OutputDir', shName: 'output-dir', type: 'string', required: true, help: '输出目录' },
        { shortName: 'l', ps1Name: 'Languages', shName: 'languages', type: 'string', required: false, help: '过滤语言代码，逗号分隔（如 zh-Hans,en-US），留空则导出所有语言' },
        { shortName: 'g', ps1Name: 'FilterTags', shName: 'filter-tags', type: 'string', required: false, help: '按标签过滤，逗号分隔，只导出含指定标签的条目' },
        { shortName: 'n', ps1Name: 'NoCodeAlias', shName: 'no-code-alias', type: 'switch', required: false, default: false, help: '文件名不使用代码别名，改用语言代码' },
        { shortName: 'd', ps1Name: 'Delete', shName: 'delete', type: 'switch', required: false, default: false, help: '导出前清理已有文件' },
        { shortName: 'm', ps1Name: 'DeleteMode', shName: 'delete-mode', type: 'enum', required: false, enumValues: ['file', 'folder'], help: '清理模式：file 仅删除 .json 文件，folder 删除整个目录' },
      ],
    },
  ],
}
