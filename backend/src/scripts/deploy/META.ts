import type { ScriptMeta } from '../scripts-types'

export const meta: ScriptMeta = {
  id: 'deploy',
  name: '部署',
  description: 'SSH 部署脚本：连接服务器 → 拉取指定分支 → `docker compose up -d --build`。',
  subcommands: [
    {
      name: '',
      desc: '',
      params: [
        { shortName: 's', ps1Name: 'ServerHost', shName: 'server-host', type: 'string', required: true, help: '服务器地址' },
        { shortName: 'P', ps1Name: 'Port', shName: 'port', type: 'int', required: false, default: 22, help: 'SSH 端口' },
        { shortName: 'u', ps1Name: 'User', shName: 'user', type: 'string', required: true, help: 'SSH 用户名' },
        { shortName: 'd', ps1Name: 'Dir', shName: 'dir', type: 'string', required: true, help: '目标部署目录（服务器上的项目路径）' },
        { shortName: 'b', ps1Name: 'Branch', shName: 'branch', type: 'string', required: true, help: '发布分支' },
      ],
    },
  ],
}
