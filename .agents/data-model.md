# 数据层与索引约定

> 本篇说明数据库表结构、原文存储约定与索引策略。

## 表结构

```
translation_keys              translation_values
+------------------+  1:N  +------------------+
| id (UUID PK)     |------>| id (UUID PK)     |
| project_id (FK)  |       | key_id (FK)      |
| key              |       | language_code    |
| context          |       | translated_text  |
| tags (TEXT[])    |       | is_reviewed      |
| is_locked (BOOL) |       +------------------+
| created_at       |
| updated_at       |
+------------------+
```

- context 和 tags 为 Key 级别属性，跨语言共享
- 原文 = 源语言语言值（源语言 value 的 translatedText），无独立存储
- `project_languages.codeAlias`（列 code_alias，由 `20260824000000_rename_project_language_code_alias` RENAME 改名）— 导出和 UI 优先显示代码别名
- `project_languages.nameAlias`（列 name_alias，`20260825000000_add_project_language_name_alias` 新增）— 语言名称别名，语言管理页「显示名称」= 名称别名 || 基础语言名称)）

## 索引约定（Postgres 不自动为 FK 列建索引）

- `translation_keys` 有复合索引 `(project_id, sort_order, key)`（listGrouped/导出排序过滤，`20260822000000`）与 unique `(project_id, key)`
- `project_members` 有 `user_id` 单列索引（fetchProjects「查我的项目」走 WHERE user_id，auth.init + 每 30s 权限轮询热路径，unique 以 project_id 为首列覆盖不了它；`20260823010000`）
- `translation_values` 所有查询均以 `key_id` 打头（导入批量 upsert 的 ON CONFLICT / 元组 IN 同样命中），由 unique `(key_id, language_code)` 首列覆盖，勿重复单建 key_id 索引
