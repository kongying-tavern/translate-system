# 改动流程与常见问题

> 本篇说明改动翻译功能的流程、schema 迁移规则与排障 FAQ。

## 改动翻译相关功能

1. 先改 `services/translation.ts` → 再改 `controllers/TranslationsController.ts` → `cd backend && pnpm gen` → 最后改前端
2. 改 `prisma/schema.prisma` → `pnpm db:migrate` 生成迁移文件 → 更新 service
   - 必须创建迁移文件；用 `db:push` 绕过会导致 Docker 部署时 `migrate deploy` 遗漏变更
   - 注意：db:push 后的 DB 没有 _prisma_migrations 记录，直接用 migrate deploy 会因列已存在报错，需先用 `migrate resolve --applied` 手动标记已存在的迁移
   - 字段改名类变更：Prisma 自动 diff 会生成 DROP+ADD（丢数据、等于重建列）
     - 必须手写迁移 SQL 为 RENAME COLUMN（范例 `20260824000000_rename_project_language_code_alias`）

> 新增受限页面（前端）：路由加 meta.perm；依赖项目角色时路径必须带 :projectSlug；AppSidebar 菜单与 useProjectPermission 增加对应权限位。
> 新增受限接口（后端）：
> 1. 选 @Security
> 2. 项目级接口 handler 内 assertProjectAccess(..., minProjectRole?)
> 3. pnpm gen 重新生成路由文档
> 4. 开放接口同步补 APIKEY_WHITELIST

## Git 分支与合并

- 主分支为 `main`
- 从 `main` 开出集成分支 `dev` 与功能分支，命名 `<类型>/<主题>`——类型沿用提交前缀习惯：`feat/`、`fix/`、`chore/`、`refactor/`、`docs/` 等（仅为示例，按改动性质选择）
- **较大的功能改动必须开新分支处理**，完成并自测后合并回主线；日常小修（单点 bugfix、文档笔误等）可直接在 `main` 提交
- 合并一律使用 merge 且**必须创建 merge commit**：`git merge --no-ff <branch>`——保留功能边界、便于整体回滚；禁止 fast-forward 吞并分支拓扑、禁止 rebase 改写已推送的主线历史

## 常见问题

1. **Vite 模块找不到** — `rm -rf node_modules/.vite && pnpm dev`
2. **Prisma 文件锁** — `rm -rf node_modules/.prisma && pnpm prisma generate`
3. **psql 中文乱码** — 用 `pnpm tsx -e "import{PrismaClient}..."` 查数据
4. **路由冲突** — /:keyId 会吃掉 /sortOrders、/batch，tsoa 按方法声明顺序注册路由，必须把 literal 路由声明在参数路由前面
5. **含 `/` 的 Key 保存报 Key not found** — UAT 前置 nginx 的 merge_slashes 把 %2F 解码成字面 `/` 并合并斜杠，key 失真
   - 编辑类操作已全面改用 keyId 定位（UUID 纯 unreserved 字符，天然免疫），列表查询无此问题
   - 再遇到 path 参数被 nginx 改写：确认前后端都走 encPathParam / decPathParam，禁止百分号编码
6. **cannot edit 报错** — GateGuard hook，用 ECC_GATEGUARD=off 前缀或加到 settings.json
7. **前端 TS 报错 Property xxx does not exist on type** — 改 schema 后未同步 `frontend/src/types/models.d.ts`，检查并添加对应字段
