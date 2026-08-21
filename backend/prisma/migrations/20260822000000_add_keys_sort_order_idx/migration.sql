-- 翻译管理页 listGrouped 与导出均按 (project_id, sort_order, key) 排序过滤，
-- 新增复合索引使排序/过滤走纯索引扫描，避免大项目额外排序。既有的单列 (key) 索引保持不变。
CREATE INDEX "translation_keys_project_id_sort_order_key_idx" ON "translation_keys"("project_id", "sort_order", "key");
