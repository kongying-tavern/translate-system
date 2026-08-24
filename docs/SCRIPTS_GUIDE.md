# 命令行脚本使用说明

## 扩展脚本

基于已部署服务（Docker 接口、前端页面）的运维与集成操作。

### import_translations.ps1 / import_translations.sh

将翻译内容（translation_value）批量导入指定语言。支持 JSON / CSV / YAML / XML / Properties 格式，需明确指定格式类型。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e, --endpoint` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k, --api-key` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s, --api-secret` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a, --auth-config` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p, --project` | 项目 Slug（UUID 或 code） |
| `-FormatType` | `-t, --format-type` | 格式类型（取值见下表） |
| `-Language` | `-l, --language` | 目标语言代码（如 `zh-Hans`，支持代码别名） |
| `-File` | `-f, --file` | 数据文件路径 |
| `-Overwrite` | `-o, --overwrite` | 覆盖已有译文（默认不覆盖） |
| `-NoAutoCreate` | `-n, --no-auto-create` | 不自动补全新条目（默认自动创建） |

**`-FormatType` / `-t` 取值说明：**

| 值 | 格式 |
|---|------|
| `json` | JSON |
| `csv` | CSV |
| `yaml` | YAML |
| `xml` | XML |
| `properties` | Properties |

#### 前置条件

- 在用户设置中创建 **API Key + Secret**

#### Shell 依赖

`import_translations.sh` 需要安装 [jq](https://jqlang.github.io/jq/) 解析 JSON。

#### 示例

```bash
./scripts/import_translations.sh \
  -e http://localhost:20080 \
  -k ak_xxx -s xxx \
  -p my-project \
  -t json -l zh-Hans \
  -f ./zh-Hans.json

# PowerShell
./scripts/import_translations.ps1 `
  -Endpoint http://localhost:20080 `
  -ApiKey ak_xxx -ApiSecret xxx `
  -ProjectSlug my-project `
  -FormatType json -Language zh-Hans `
  -File .\zh-Hans.json
```

---

### import_entries.ps1 / import_entries.sh

将条目定义（translation_key）批量导入项目。支持 JSON / CSV / YAML / XML 格式，后端自动检测。

#### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e, --endpoint` | 服务器地址，如 `http://localhost:20080` |
| `-ApiKey` | `-k, --api-key` | API Key，以 `ak_` 开头，与 `-AuthConfig` 二选一 |
| `-ApiSecret` | `-s, --api-secret` | API Secret，与 `-AuthConfig` 二选一 |
| `-AuthConfig` | `-a, --auth-config` | 鉴权信息文件路径（JSON，包含 `apiKey` 和 `apiSecret`） |
| `-ProjectSlug` | `-p, --project` | 项目 Slug（UUID 或 code） |
| `-File` | `-f, --file` | 数据文件路径 |
| `-Overwrite` | `-o, --overwrite` | 覆盖已有条目（默认不覆盖） |

#### 前置条件

- 在用户设置中创建 **API Key + Secret**

#### Shell 依赖

`import_entries.sh` 需要安装 [jq](https://jqlang.github.io/jq/) 解析 JSON。

#### 示例

```bash
./scripts/import_entries.sh \
  -e http://localhost:20080 \
  -k ak_xxx -s xxx \
  -p my-project \
  -f ./entries.json

# PowerShell
./scripts/import_entries.ps1 `
  -Endpoint http://localhost:20080 `
  -ApiKey ak_xxx -ApiSecret xxx `
  -ProjectSlug my-project `
  -File .\entries.json `
  -Overwrite
```

---

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
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，支持语言代码或代码别名（如 `zh-Hans,简体中文`），不传则导出全部 |
| `-NoCodeAlias` | `-n, --no-code-alias` | 输出的 langCode/文件名 使用语言代码而非代码别名（codeAlias） |
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
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，支持语言代码或代码别名，不传则导出全部 |
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
| `-Languages` | `-l, --languages` | 过滤语言，逗号分隔，支持语言代码或代码别名，不传则全部 |
| `-NoCodeAlias` | `-n, --no-code-alias` | 输出的 langCode/文件名 使用语言代码而非代码别名（codeAlias） |
| `-NoNameAlias` | `-N, --no-name-alias` | 输出的 langName 跳过语言别名（nameAlias），直接使用语言名称 |
| `-InputFormat` | `-f, --input-format` | 输入文件类型: json/yaml/xml/properties/csv，默认 `json` |
| `-OutputFormat` | `-t, --output-format` | 输出文件类型: json/yaml/xml，默认 `json` |
| `-InputDir` | `-i, --input-dir` | 包含翻译文件的目录（必填） |
| `-OutputFile` | `-o, --output` | 输出文件路径，默认 `<InputDir>/summary.<格式>` |

#### 输出示例

```json
[{"langName":"简体中文","langCode":"zh-Hans","md5Hash":"...","summary":{"countTotal":100,"countTranslated":80,"ratioTranslated":80.0}}]
```

输出字段取值逻辑：

| 字段 | 关闭开关 | 取值逻辑（依次回退） |
|------|:-------|---------------------|
| `langCode` | `-n, --no-code-alias` | codeAlias → languageCode（跳过 codeAlias） |
| `langName` | `-N, --no-name-alias` | nameAlias → languageName → languageCode（跳过 nameAlias） |

> 语言名称取自基础语言数据（只读接口 `GET /languages`，已在 API Key 白名单内）；拉取失败时打印警告并跳过该级回退。

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

## 开发脚本

用于本地开发环境的数据操作，脚本内部自动定位 backend/frontend 目录，在项目根目录下直接运行即可。

> 暂无开发脚本。


