# 命令行脚本使用说明

## 扩展脚本

基于已部署服务（Docker 接口、前端页面）的运维与集成操作。

### download_translations_single.ps1 / download_translations_single.sh

从服务器导出翻译文件，每语言一个单独文件。

> 仅适用于以下格式（白名单），若模板格式不在其中则脚本报错退出：
> - `flat-json`
> - `nested-json`
> - `flat-yaml`
> - `nested-yaml`
> - `properties`
> - `flat-xml`
> - `nested-xml`
> - `csv`

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p` | 项目 Slug（UUID 或 code） |
| `-TemplateSlug` | `-t` | 导出模板 Slug（UUID 或 code） |
| `-OutputDir` | `-o` | 输出目录 |
| `-Languages` | `-l` | 过滤语言，逗号分隔，支持 code 或 alias（如 `zh-Hans,简体中文`），不传则导出全部 |
| `-NoAlias` | `-n` | 输出文件名及字段名使用语言代码而非别名 |
| `-Delete` | `-d` | 写文件前若有则删除（`file` 模式）或导出前删整个目录（`folder` 模式） |
| `-DeleteMode` | `-m` | 清理模式：`file` 写文件前删除同路径旧文件，`folder` 删整个目录，默认 `file` |

#### 前置条件

- 在项目 Web 端创建一个**导出模板**，拿到其 Slug（UUID 或 code）
- 在用户设置中创建 **API Key + Secret**

#### Shell 依赖

`download_translations_single.sh` 需要安装 [Node.js](https://nodejs.org/) 解析 JSON。

---

### deploy.ps1 / deploy.sh

SSH 部署脚本：连接服务器 → 拉取指定分支 → `docker compose up -d --build`。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Host` | `-h` | 服务器地址 |
| `-Port` | `-P` | SSH 端口，默认 `22` |
| `-User` | `-u` | SSH 用户名 |
| `-Dir` | `-d` | 服务器上项目部署路径 |
| `-Branch` | `-b` | 发布分支 |

#### 示例

```bash
./scripts/deploy.sh -h 192.168.1.100 -P 22 -u root -d /opt/translate-system -b main

# PowerShell
./scripts/deploy.ps1 -Host 192.168.1.100 -Port 22 -User root -Dir /opt/translate-system -Branch main
```

#### 前置条件

- 服务器已安装 Docker + Docker Compose
- 目标目录已 clone 项目并配置好 `.env`

---

## 开发脚本

用于本地开发环境的数据操作，脚本内部自动定位 backend/frontend 目录，在项目根目录下直接运行即可。

### dev_import_translations.ps1 / dev_import_translations.sh

将目录下所有 JSON 翻译文件批量导入项目，文件名作为语言代码。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-ProjectCode` | 第一个位置参数 | 项目 Slug 或 Code（如 `my-project`） |
| `-Directory` | 第二个位置参数 | 包含 JSON 文件的目录路径 |

#### 文件命名约定

文件名即为语言代码，如 `zh-Hans.json`、`en-US.json`、`ja-JP.json`。

#### 示例

```bash
./scripts/dev_import_translations.sh my-project /app/translations

# PowerShell
./scripts/dev_import_translations.ps1 -ProjectCode my-project -Directory C:\translations\
```

#### 前置条件

- 后端服务运行中，数据库包含目标项目
- 后端依赖已安装（`cd backend && pnpm install`）

---

### import-json.ts（底层脚本）

```bash
cd backend
pnpm tsx src/scripts/import-json.ts <项目ID> <JSON文件路径> <语言代码>
```

`dev_import_translations` 底层调用的导入脚本，也可单独使用（需在 `backend/` 下执行）。
