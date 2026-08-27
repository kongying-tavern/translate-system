# 导入与导出

> 本篇说明导入解析校验、并发锁/进度 SSE 与导出 8 种格式及模板配置。

## 导入：解析校验（ImportsController parseImportData）

解析失败不再静默返回空数组，统一抛 `AppError(InvalidParams)` 中文提示；前端 showImportError 优先展示服务端 message。

### 格式识别与硬校验

- sniffFormat 自动识别：`{`/`[`→JSON、`<`→XML、缩进或 `key: value`→YAML、`key=value` 或 `key:value`→Properties、其余→CSV
- 解析出 0 条 → 拒绝「未从数据中解析到任何条目」；空 key → 拒绝并提示第 N 条
- JSON/YAML 顶层必须是键值映射（数组/标量拒绝）；嵌套结构用 looksLikeLang 启发式判定（外层键都像语言代码才按「语言→Key→译文」解析）
- CSV 表头严格匹配（大小写一致、无别名）：仅识别 key / sourceText / tags / context；导出表头 `key,<语言...>` 与之对应
- XML：缺 resources 根节点、string 缺 name、language 缺 code 均报错定位；译文按原样字符串解析（不转数值），纯数字/前导零不丢失
- **值原样保存**：Key、原文、译文导入时均不 trim——仅校验非空白（空白 Key 拒绝），前后空格按输入原样落库

### 原文（sourceText）约定

- translation_keys 无 source_text 列，原文 = 源语言 value 的 translatedText
- 条目导入（importKeys）：支持 sourceText 或源语言列，等价于更新源语言 value
- 译文导入（applyTranslations）：不支持 sourceText，且一律跳过源语言列（源语言译文即原文）；跳过数经 sourceSkippedFields 返回
- 语言列先做 code/alias → 规范 code 映射再写入；alias 归一到真实语言，绝不按 alias 落库
- 存量升级由迁移 20260808020000_remove_source_text 内置回填，无需脚本

### 未配置语言的处理

- 不拒绝、不自动建语言：写入遍历中流式内联预过滤整条丢弃，累计 skippedLanguages 返回并在前端列出
- 仅含未配置语言的 key 不创建（不落空 key 行）；importKeys 无语言属性，恒返回 skippedLanguages: []

### 统计口径（双维度，所有格式通用）

| 维度 | 字段 | 前端提示用语 |
|------|------|--------------|
| 去重键 | importedKeys / createdKeys / skippedKeys | 「个条目」（条目导入模式） |
| 字段 | importedFields / createdFields / skippedFields | 「个字段」（译文导入模式） |

## 导入：并发控制与进度

### 锁与异步执行

- import-lock.ts 进程内 Map<projectId, ImportControl>：同项目互斥（再导入返回 Conflict 1004），跨项目不受限
- 接口只鉴权 + 抢锁，立即返回 `{ accepted: true }`；实际解析/写入在 runImportInBackground 后台执行
- 结束后 ImportControl 置 done 并保留 result/error，仍可从 GET /imports/status 读到

### 写入性能优化（IMPORT_BATCH=1000，勿退回逐条事务）

| # | 优化 | 做法 |
|---|------|------|
| A | 批量 upsert 译文 | bulkWriteTranslationValues：单条 INSERT ... ON CONFLICT (key_id, language_code) DO UPDATE |
| B | 批量更新 Key 元信息 | bulkUpdateKeyMeta：UPDATE ... FROM (VALUES ...) 更新 context/tags |
| C | 减少往返 | B 与 A 合并进同一 $transaction |
| D | 免回查 | createManyAndReturn 直接拿回 {id, key} |
| E | 去重 | toWrite 按 (keyId, lang) Map 去重取末值 |
| F | 精确预载 | (key_id, language_code) 元组 IN 匹配，避免笛卡尔积 |
| G | OOM 防线 | 未配置语言过滤 + 分批写入为单次流式遍历，无全量中间数组 |
| H | OOM 防线 | keyIdCache 上限 IMPORT_KEY_CACHE_MAX=50000，超限清空重查 |
| I | 解析惰性化 | 五种格式均为惰性 Iterable<ImportEntry>，可重复迭代两轮消费 |

- SSE 推送（getImportStatusStream）：进行中按 250ms 节流，节流判断前置到 buildImportStatusRow 之前
- parseImportData 每解析 1000 条 deferEventLoop() 让出事件循环

### 进度 / 状态 / 中止

- ImportProgress 共 8 字段，按阶段分组：
  - 解析阶段：parsedFields、parsedKeys
  - 写入阶段：totalFields → createdFields / skippedFields；totalKeys → createdKeys / skippedKeys
  - phase 取值：parsing / writing / done
- parseImportData 每解析 1000 条 deferEventLoop() 让出事件循环，避免大文件阻塞
- GET /imports/status → ImportStatusRow：locked/type/startUserId/startUsername/startTimestamp/progress/result/error
- POST /imports/abort：置 aborted 标志，解析阶段与每个写入批次开头检查；仅发起人或 super_admin 可中止

### 前端导入页行为（ImportTemplateView.vue）

- 状态以最近一次轮询为准；轮询间隔：进行中 2s / 空闲 30s
- 结果提示在轮询带回时弹出（startTimestamp 去重）；wasImporting 仅在 POST accepted 后置位
- 进行中禁用所有业务控件（两个 radio-group 可切换）；发起人可见「中止导入」，doAbort 收到确认立即提示
- 文本输入走「填写内容」720px 草稿弹窗；说明卡片 HTML 经 v-dompurify-html 净化

### 导入锁（useImportStatus composable + SSE）

- 优先 SSE（fetch 带 Authorization 读流），isLocked = 远程锁 ∥ 本地提交锁（5s 超时兜底）；断开自动回退轮询
- 暴露 isLocked / importerName / bannerTitle / statsLines / status 等
- 接入页面：翻译管理、语言管理、项目编辑（整页禁写）、首页卡片（徽标+禁操作）；结束约 2s 自动解锁

## 导出：8 种格式

定义在 `frontend/src/data/exportFormats.ts` 的 EXPORT_FORMAT_MAP：

| 格式 | 后缀 | 单/多语言 | 说明 |
|------|:---:|:---:|------|
| flat-json | .json | 单 | 扁平 key-value 映射 |
| nested-json | .json | 多 | 按语言嵌套的映射 |
| flat-yaml | .yaml | 单 | 扁平 key-value 映射 |
| nested-yaml | .yaml | 多 | 按语言嵌套的映射 |
| properties | .properties | 单 | Java 键值对，特殊字符自动转义 |
| flat-xml | .xml | 单 | Android resources/string 结构 |
| nested-xml | .xml | 多 | 按语言嵌套的 XML 结构 |
| csv | .csv | 多 | 表格，key + 各语言一列 |

## 导出模板 config 字段

```json
{ "skipIdentical": true, "skipEmpty": true, "useCodeKey": false }
```
