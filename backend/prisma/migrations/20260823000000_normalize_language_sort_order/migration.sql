-- 存量项目语言的 sortOrder 曾默认全为 0（新增语言未赋值），并列时列表按 language_code 兜底排序，
-- 且旧版上下移动只交换相邻两值会制造新并列，刷新后顺序回退。
-- 按每个项目内当前显示顺序（sort_order asc, language_code asc）重排为递增序列：
-- 显示顺序零变化，仅把隐式并列固化为显式唯一值；前端移动后仍会全量重编号，步长仅影响初始间隙。
WITH ranked AS (
  SELECT
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY sort_order, language_code) AS rn
  FROM project_languages
)
UPDATE project_languages pl
SET sort_order = (r.rn - 1) * 100
FROM ranked r
WHERE pl.id = r.id;
