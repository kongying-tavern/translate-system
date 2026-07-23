-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source_language" VARCHAR(35) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_languages" (
    "language_code" VARCHAR(35) NOT NULL,
    "english_name" VARCHAR(255) NOT NULL,
    "native_name" VARCHAR(255),
    "iso_639_1" VARCHAR(2),
    "iso_639_2" VARCHAR(3),
    "iso_639_3" VARCHAR(3),
    "region" VARCHAR(100),

    CONSTRAINT "base_languages_pkey" PRIMARY KEY ("language_code")
);

-- CreateTable
CREATE TABLE "project_languages" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "language_code" VARCHAR(35) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "language_code" VARCHAR(35) NOT NULL,
    "translation_key" VARCHAR(500) NOT NULL,
    "source_text" TEXT NOT NULL,
    "translated_text" TEXT NOT NULL DEFAULT '',
    "context" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewer_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_templates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "thumbnail_url" VARCHAR(500),
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_configs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "template_id" UUID,
    "override_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_templates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "format_type" VARCHAR(50) NOT NULL DEFAULT 'custom',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_languages_project_id_language_code_key" ON "project_languages"("project_id", "language_code");

-- CreateIndex
CREATE INDEX "translations_project_id_language_code_idx" ON "translations"("project_id", "language_code");

-- CreateIndex
CREATE INDEX "translations_translation_key_idx" ON "translations"("translation_key");

-- CreateIndex
CREATE UNIQUE INDEX "translations_project_id_language_code_translation_key_key" ON "translations"("project_id", "language_code", "translation_key");

-- CreateIndex
CREATE INDEX "layout_templates_project_id_idx" ON "layout_templates"("project_id");

-- CreateIndex
CREATE INDEX "layout_configs_project_id_idx" ON "layout_configs"("project_id");

-- CreateIndex
CREATE INDEX "layout_configs_template_id_idx" ON "layout_configs"("template_id");

-- CreateIndex
CREATE INDEX "export_templates_project_id_idx" ON "export_templates"("project_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_languages" ADD CONSTRAINT "project_languages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_templates" ADD CONSTRAINT "layout_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_configs" ADD CONSTRAINT "layout_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_configs" ADD CONSTRAINT "layout_configs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "layout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_templates" ADD CONSTRAINT "export_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
