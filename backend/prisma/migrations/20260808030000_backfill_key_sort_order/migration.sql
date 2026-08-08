-- 存量 key 的 sortOrder 全为默认值 0，导致前端拖拽折半插入无法生效。
-- 按每个项目内当前显示顺序（sortOrder asc, key asc）重排为递增序列，步长 100，为后续拖拽插入留出空位。
WITH ranked AS (
  SELECT
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY sort_order, key) AS rn
  FROM translation_keys
)
UPDATE translation_keys tk
SET sort_order = (r.rn - 1) * 100
FROM ranked r
WHERE tk.id = r.id;
