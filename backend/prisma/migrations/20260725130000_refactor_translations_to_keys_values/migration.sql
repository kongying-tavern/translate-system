-- Drop the old single-table schema created by the init migration
DROP TABLE IF EXISTS "translations" CASCADE;

-- CreateTable: translation_keys (key-level attributes shared across languages)
CREATE TABLE "translation_keys" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "source_text" TEXT NOT NULL,
    "context" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "translation_keys_project_id_key_key" ON "translation_keys"("project_id", "key");
CREATE INDEX "translation_keys_key_idx" ON "translation_keys"("key");

-- CreateTable: translation_values (language-specific values per key)
CREATE TABLE "translation_values" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "language_code" VARCHAR(35) NOT NULL,
    "translated_text" TEXT NOT NULL DEFAULT '',
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewer_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "translation_values_key_id_language_code_key" ON "translation_values"("key_id", "language_code");

-- AddForeignKey
ALTER TABLE "translation_keys" ADD CONSTRAINT "translation_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_values" ADD CONSTRAINT "translation_values_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
