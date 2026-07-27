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
| `-Endpoint` | `-e, --endpoint` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k, --api-key` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s, --api-secret` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a, --auth-config` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p, --project` | 项目 Slug（UUID 或 code） |
| `-TemplateSlug` | `-t, --template` | 导出模板 Slug（UUID 或 code） |
| `-OutputDir` | `-o, --output-dir` | 输出目录 |
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，支持 code 或 alias（如 `zh-Hans,简体中文`），不传则导出全部 |
| `-NoAlias` | `-n, --no-alias` | 输出文件名及字段名使用语言代码而非别名 |
| `-Delete` | `-d, --delete` | 写文件前若有则删除（`file` 模式）或导出前删整个目录（`folder` 模式） |
| `-DeleteMode` | `-m, --delete-mode` | 清理模式：`file` 写文件前删除同路径旧文件，`folder` 删整个目录，默认 `file` |

#### 前置条件

- 在项目 Web 端创建一个**导出模板**，拿到其 Slug（UUID 或 code）
- 在用户设置中创建 **API Key + Secret**

#### Shell 依赖

`download_translations_single.sh` 需要安装 [jq](https://jqlang.github.io/jq/) 解析 JSON。

---

### download_translations_multi.ps1 / download_translations_multi.sh

一次性导出全部语言到单个文件。仅适用于以下格式（白名单），若模板格式不在其中则脚本报错退出：
- `nested-json`
- `nested-yaml`
- `nested-xml`
- `csv`

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e, --endpoint` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k, --api-key` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s, --api-secret` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a, --auth-config` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p, --project` | 项目 Slug（UUID 或 code） |
| `-TemplateSlug` | `-t, --template` | 导出模板 Slug（UUID 或 code） |
| `-OutputFile` | `-o, --output-file` | 输出文件路径 |
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，不传则导出全部 |
| `-Delete` | `-d, --delete` | 导出前删除已存在的输出文件 |

#### 前置条件

- 在项目 Web 端创建一个**多语言导出模板**，拿到其 Slug
- 在用户设置中创建 **API Key + Secret**

#### Shell 依赖

`download_translations_multi.sh` 需要安装 [jq](https://jqlang.github.io/jq/) 解析 JSON。

---

### summarize_translations.ps1 / summarize_translations.sh

读取 `download_translations_single` 导出的文件目录，生成各语言的翻译统计汇总 JSON。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e, --endpoint` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k, --api-key` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s, --api-secret` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a, --auth-config` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p, --project` | 项目 Slug（UUID 或 code） |
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，支持 code 或 alias，不传则全部 |
| `-NoAlias` | `-n, --no-alias` | 文件名和输出的 langCode 使用语言代码而非别名 |
| `-InputFormat` | `-f, --input-format` | 输入文件类型: json/yaml/xml/properties/csv，默认 `json` |
| `-OutputFormat` | `-t, --output-format` | 输出文件类型: json/yaml/xml，默认 `json` |
| `-InputDir` | `-i, --input-dir` | 包含翻译文件的目录（必填） |
| `-OutputFile` | `-o, --output` | 输出文件路径，默认 `<InputDir>/summary.json` |

#### 输出示例

```json
[{"langName":"zh-Hans","langCode":"简体中文","md5Hash":"...","summary":{"countTotal":100,"countTranslated":80,"ratioTranslated":80.0}}]
```

#### Shell 依赖

`summarize_translations.sh` 需要安装 [jq](https://jqlang.github.io/jq/)。输入/输出含 YAML 需 [yq](https://github.com/mikefarah/yq)，含 XML 需 [xmlstarlet](http://xmlstar.sourceforge.net/)。

---

### folder_lock.ps1 / folder_lock.sh

伪锁定方案：在临时目录中处理文件，完成后同步到目标目录，避免目标目录出现中间状态文件。

#### 参数

| PS1 | Sh | 说明 |
|-----|----|------|
| `-Target` | `-t, --target <目录>` | 目标目录（必填） |
| `-Delete` | `-d, --delete` | lock 时清空目标目录；unlock 时移动而非复制 |

#### `lock [--delete]`

创建临时目录并写入 `.staging_lock` 标记文件，输出临时目录路径。`--delete` 清空目标目录后再创建。

`lock` 输出临时目录路径（如 `/tmp/staging.abc123/`），用 `$(...)` 捕获到变量后传给后续命令。

```bash
STAGING=$(./scripts/folder_lock.sh --target ./translations lock --delete)
./scripts/download_translations_single.sh ... -o "$STAGING"
```

#### `unlock [--delete]`

将临时目录中所有文件同步到目标目录，移除标记文件。缺省为**复制**（保留临时目录），`--delete` 为**移动**（删除临时目录中源文件）。

```bash
./scripts/folder_lock.sh --target ./translations unlock
# 或移动模式
./scripts/folder_lock.sh --target ./translations unlock --delete
```

#### `status`

查看锁定状态。输出 `locked: <临时目录路径>` 或 `unlocked`。

```bash
./scripts/folder_lock.sh --target ./translations status
```

---

### deploy.ps1 / deploy.sh

SSH 部署脚本：连接服务器 → 拉取指定分支 → `docker compose up -d --build`。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Host` | `-h, --host` | 服务器地址 |
| `-Port` | `-P, --port` | SSH 端口，默认 `22` |
| `-User` | `-u, --user` | SSH 用户名 |
| `-Dir` | `-d, --dir` | 服务器上项目部署路径 |
| `-Branch` | `-b, --branch` | 发布分支 |

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
