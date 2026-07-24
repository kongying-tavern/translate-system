# 命令行脚本使用说明

## download_translations.ps1 / download_translations.sh

从服务器导出翻译文件，每语言一个 JSON 文件。

### 参数

| PS1 参数 | Sh 参数 | 说明 |
|----------|---------|------|
| `-Endpoint` | `-e` | 服务器地址，如 `http://localhost:20080` |
| `-ProjectSlug` | `-p` | 项目 Slug（UUID 或 code） |
| `-ApiKey` | `-k` | API Key，以 `ak_` 开头 |
| `-ApiSecret` | `-s` | API Secret |
| `-TemplateSlug` | `-t` | 导出模板 Slug（UUID 或 code） |
| `-OutputDir` | `-o` | 输出目录 |
| `-Languages` | `-l` | 过滤语言，逗号分隔（如 `zh-Hans,en-US`），不传则导出全部 |
| `-Delete` | `-d` | 导出前清理输出目录 |
| `-DeleteMode` | `-m` | 清理模式：`file` 仅删 `.json`，`folder` 删整个目录，默认 `file` |

### 前置条件

- 在项目 Web 端创建一个**导出模板**，拿到其 Slug（UUID 或 code）
- 在用户设置中创建 **API Key + Secret**

### Shell 依赖

`download_translations.sh` 需要安装 [jq](https://jqlang.github.io/jq/) 解析 JSON。

---

## backend 导入脚本

```bash
cd backend
pnpm tsx src/scripts/import-json.ts <项目ID> <JSON文件路径> <语言代码>
```
