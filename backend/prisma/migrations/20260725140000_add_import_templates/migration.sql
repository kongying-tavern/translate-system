CREATE TABLE "import_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "format_type" VARCHAR(50) NOT NULL DEFAULT 'flat-json',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_import_templates_project" ON "import_templates"("project_id");
