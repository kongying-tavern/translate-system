-- project_members 既有唯一约束 (project_id, user_id) 以 project_id 为首列，
-- 无法服务「按 user_id 查我的项目」——auth.init 加载项目列表与每 30s 权限轮询的
-- fetchProjects 均走 WHERE user_id，补单列索引避免全表扫描。
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");
