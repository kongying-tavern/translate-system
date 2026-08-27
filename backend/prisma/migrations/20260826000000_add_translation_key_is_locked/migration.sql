-- 翻译条目新增「锁定」标记；默认 false，锁定后仅 Maintainer+ 可编辑译文
ALTER TABLE "translation_keys" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;
