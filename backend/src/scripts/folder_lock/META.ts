import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'folder_lock',
  name: '目录伪锁定',
  description: '伪锁定方案：在临时目录中处理文件，完成后同步到目标目录，避免目标目录出现中间状态文件。',
  subcommands: [
    {
      name: '',
      desc: '',
      params: [
        { shortName: 't', ps1Name: 'Target', shName: 'target', type: 'string', required: true, help: '目标目录' },
      ],
      subcommands: [
        {
          name: 'lock',
          desc: '锁定指定目录：将目录内容移动到隐藏的临时目录',
          params: [
            { shortName: 'd', ps1Name: 'Delete', shName: 'delete', type: 'switch', required: false, default: false, help: '清空目标目录后重建' },
          ],
        },
        {
          name: 'unlock',
          desc: '解锁指定目录：将临时目录内容移回原目录',
          params: [
            { shortName: 'd', ps1Name: 'Delete', shName: 'delete', type: 'switch', required: false, default: false, help: '移动文件并从临时目录中删除原文件' },
          ],
        },
        {
          name: 'status',
          desc: '查看指定目录的锁定状态',
          params: [],
        },
      ],
    },
  ],
}
