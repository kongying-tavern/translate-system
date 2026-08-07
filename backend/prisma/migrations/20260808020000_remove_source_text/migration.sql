-- 数据回填：将存量 source_text 原文搬入源语言语言值（在删除列之前执行）
-- 源语言语言值不存在 → 新建；已存在但为空串 → 回填；已存在且非空 → 不覆盖
INSERT INTO translation_values (id, key_id, language_code, translated_text, is_reviewed, created_at, updated_at)
SELECT gen_random_uuid(), k.id, p.source_language, k.source_text, false, now(), now()
FROM translation_keys k
JOIN projects p ON p.id = k.project_id
WHERE k.source_text IS NOT NULL
  AND k.source_text <> ''
ON CONFLICT (key_id, language_code) DO UPDATE
SET translated_text = EXCLUDED.translated_text,
    updated_at = now()
WHERE translation_values.translated_text = '';

-- AlterTable: 移除翻译键上的 source_text 列，原文改由源语言语言值承载
ALTER TABLE "translation_keys" DROP COLUMN "source_text";
