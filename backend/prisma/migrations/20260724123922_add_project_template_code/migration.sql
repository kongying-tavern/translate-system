-- Add code column to projects
ALTER TABLE "projects" ADD COLUMN "code" VARCHAR(100);
UPDATE "projects" SET "code" = CONCAT('proj-', LEFT("id"::text, 8)) WHERE "code" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- Add code column to export_templates (unique per project)
ALTER TABLE "export_templates" ADD COLUMN "code" VARCHAR(100);
UPDATE "export_templates" SET "code" = CONCAT('tmpl-', LEFT("id"::text, 8)) WHERE "code" IS NULL;
ALTER TABLE "export_templates" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "export_templates_project_id_code_key" ON "export_templates"("project_id", "code");
