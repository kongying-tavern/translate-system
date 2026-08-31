import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'folder_lock',
  name: '目录伪锁定',
  params: [
    { shortName: '', ps1Name: 'Command', shName: '', type: 'enum', required: true, enumValues: ['lock', 'unlock', 'status'], help: '命令: lock / unlock / status' },
    { shortName: 't', ps1Name: 'Target', shName: 'target', type: 'string', required: true, help: '目标目录' },
    { shortName: 'd', ps1Name: 'Delete', shName: 'delete', type: 'switch', required: false, default: false, help: 'lock: 清空目标目录后重建；unlock: 移动文件并从临时目录中删除原文件' },
  ],
}
