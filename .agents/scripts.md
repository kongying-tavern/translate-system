# 脚本系统

> 脚本系统的后端数据模型、API 契约、前端组件架构与预构建机制。

## 后端数据模型

```typescript
// backend/src/scripts/scripts-types.ts

interface ScriptMeta {
  id: string              // 脚本标识（= 目录名）
  name: string            // 显示名
  description: string     // 一行简介
  subcommands: SubcommandMeta[]  // 根级子命令（必选，至少一项）
}

interface SubcommandMeta {
  name: string            // 子命令名；'' 表示根级参数（无名子命令）
  desc: string            // 子命令描述
  params: ScriptParamMeta[]
  subcommands?: SubcommandMeta[]  // 递归嵌套（可选）
}

interface ScriptParamMeta {
  shortName: string       // 单字母短名（ps1/sh 一致）
  ps1Name: string         // ps1 PascalCase 长名
  shName: string          // sh kebab-case 长名
  type: 'string' | 'switch' | 'int' | 'enum'
  required: boolean
  default?: string | number | boolean | null
  enumValues?: string[]
  help: string
}
```

所有脚本的 `subcommands` 结构完全一致：第一项 `name: ''` 是没有名字和描述的子命令（承载根级参数），后续项是命名子命令。子命令可无限嵌套。

例如 `deploy` 只有一项根级参数：`[{ name: '', params: [...] }]`；`folder_lock` 有根级参数 + 命名子命令：`[{ name: '', params: [...] }, { name: 'lock', subcommands: [...] }, { name: 'unlock', ... }]`。

## API 契约

```
GET /scripts                          → ScriptInfo[]
GET /scripts/{id}                     → ScriptInfo
GET /scripts/{id}/download?platform   → ScriptDownload
GET /scripts/manager/download?platform → { available: boolean }
```

统一响应结构 `{ code: 0, message: '', data: T }`，前端 `apiGet<T>()` 自动解包。

鉴权：脚本接口免授权，开放给所有使用者。

## services/scripts.ts 关键函数

- `listScripts()` → 返回全部 `ScriptInfo`（META + .sha256 + fileStat）
- `getScript(id)` → 单个脚本
- `getScriptDownload(id, platform)` → 文件内容 + sha256
- `fileStat(rel)` → 读文件拿 size + 读 .sha256 拿 sha256（不算哈希）
- `toSubcommand(sc)` → META 递归映射到 `SubcommandInfo`

## 预构建

```bash
pnpm gen:scripts     # tsx src/scripts/gen-scripts.ts
```

`gen-scripts.ts` 扫描 `backend/src/scripts/*/SCRIPT.{ps1,sh}`，为每个文件预算 SHA256 写入 `*.sha256`。`SCRIPT.{ext}.sha256` 文件 gitignore，构建时重新生成。

时机：`predev`（开发）和 `Dockerfile` RUN 阶段（部署），与 `gen:openapi` 同级。

## 前端组件架构

```
ScriptsView
├── ScriptManagerHero        # 管理器下载首页
│   └── OsDownloadCard × 3   # 平台下载卡片（OsIcon + Download）
├── ScriptUsagePanel          # 安装/使用方式 tab（BaseTabs）
├── ScriptSubcommandBlock     # 递归渲染子命令 + 参数表（BaseTable）
└── ScriptFingerprint         # 脚本指纹 + 复制按钮（BaseButton）
```

路由：`/scripts`，侧边栏 `el-tabs tab-position="left"`（不支持 BaseTabs）。

布局：右侧上固定（标题 + 描述 + ScriptUsagePanel），下滚动（BaseTabs 切换 PowerShell/Bash + ScriptSubcommandBlock + ScriptFingerprint）。

API 类型定义：`frontend/src/api/scripts.ts`（`ScriptInfo` / `ScriptSubcommand` / `ScriptParam` 等），`apiGet<T>()` 泛型自动推导，无 `as` 断言。

## 改动 checklist

改控制器后：`pnpm gen:openapi`
改 META.ts 后：无需额外操作（运行时读取）
改脚本文件后：`pnpm gen:scripts`（重新算哈希）
加新脚本：见 `docs/scripts.md`
