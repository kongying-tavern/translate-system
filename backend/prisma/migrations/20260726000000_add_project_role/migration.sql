ALTER TABLE "project_members" ADD COLUMN "project_role" VARCHAR(20) NOT NULL DEFAULT 'member';
UPDATE "project_members" SET "project_role" = 'admin' WHERE "user_id" IN (SELECT "user_id" FROM "projects" WHERE "id" = "project_members"."project_id");
