-- 项目语言新增「名称别名」列（语言别名，与 code_alias 对称）
-- 显示名 = 名称别名优先、为空回退基础语言名称；可空列直接 ADD COLUMN，无数据风险
ALTER TABLE "project_languages" ADD COLUMN "name_alias" VARCHAR(100);
