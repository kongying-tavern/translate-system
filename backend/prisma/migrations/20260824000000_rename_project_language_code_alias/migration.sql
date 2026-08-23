-- 项目语言「代码别名」物理列更名：alias -> code_alias（与 UI「代码别名」命名对齐）
-- 使用 RENAME COLUMN 保留全部存量数据（Prisma 自动 diff 会生成 DROP+ADD，故手写）
ALTER TABLE "project_languages" RENAME COLUMN "alias" TO "code_alias";
