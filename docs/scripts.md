# 脚本系统

> 开发者维护指南：目录结构、添加新脚本、META.ts 编写与构建流程。

## 概述

脚本系统为翻译管理平台提供命令行操作能力。每个脚本同时提供 PowerShell（`SCRIPT.ps1`）和 Shell（`SCRIPT.sh`）两种实现，参数与语义对齐。

脚本的元数据通过 `META.ts` 声明，后端 API 输出后由前端「脚本管理」页面展示。终端用户可直接在页面上查看参数与用法，无需查阅本文。

## 目录结构

```
backend/src/scripts/
├── scripts-types.ts          # 共享类型
├── gen-scripts.ts            # 预构建脚本：预算 SHA256 → *.sha256
├── deploy/
│   ├── META.ts               # 脚本元数据（手写）
│   ├── SCRIPT.ps1            # PowerShell 实现
│   └── SCRIPT.sh             # Shell 实现
├── import_translations/
│   ├── META.ts
│   ├── SCRIPT.ps1
│   └── SCRIPT.sh
└── ...
```

`SCRIPT.ps1.sha256` / `SCRIPT.sh.sha256` 文件由 `gen-scripts.ts` 在构建时生成，不提交。

## 添加新脚本

1. 创建目录 `backend/src/scripts/<name>/`
2. 编写 `SCRIPT.ps1` 和 `SCRIPT.sh`（参数须对齐，见下方规范）
3. 编写 `META.ts`（导出 `meta: ScriptMeta`）
4. 在 `backend/src/services/scripts.ts` 的 `SOURCES` 数组中添加一项
5. 执行 `pnpm gen:scripts` 生成 `SCRIPT.{ext}.sha256` 文件
6. 重启后端，前端自动加载新脚本

## META.ts 编写

每个脚本目录下的 `META.ts` 导出一个 `meta` 对象。无子命令的脚本：

```typescript
export const meta: ScriptMeta = {
  id: 'deploy',
  name: '部署',
  description: 'SSH 部署脚本：连接服务器 → 拉取分支 → docker compose up。',
  subcommands: [{
    name: '',       // 无子命令时为空字符串
    desc: '',
    params: [
      { shortName: 's', ps1Name: 'ServerHost', shName: 'server-host', type: 'string', required: true, help: '服务器地址' },
      // ...
    ],
  }],
}
```

有子命令的脚本（如 `folder_lock`），顶层 `name: ''` 放全局参数，嵌套 `subcommands` 放各子命令。

字段说明见 `backend/src/scripts/scripts-types.ts` 中的 `ScriptMeta` / `SubcommandMeta` / `ScriptParamMeta`。

## 参数对齐规范

1. 同一逻辑参数的 ps1 与 sh 短名一致（如 `-e`）
2. 长名按平台命名习惯：ps1 用 PascalCase（`-Endpoint`），sh 用 kebab-case（`--endpoint`）
3. 短参数避让 `-h`（保留给帮助）和 `-v`（保留给版本）
4. PowerShell 参数名大小写不敏感，短参数不要用仅靠大小写区分的两个字母

## 预构建命令

```bash
pnpm gen:scripts     # 预算脚本 SHA256 → SCRIPT.{ext}.sha256 文件
```

Docker 构建阶段（`Dockerfile`）按顺序执行 `gen:openapi` → `gen:scripts` → `prisma generate`。
`pnpm dev` 的 `predev` 会自动执行 `pnpm gen:openapi && pnpm gen:scripts`。

## 尚未实现

- **脚本管理器（CLI）**：用于管理脚本的命令行工具，支持下载 / 比对 / 更新。前端下载页已预留入口，后端接口返回 `{ available: false }`
