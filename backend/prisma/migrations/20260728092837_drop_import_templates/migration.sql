/*
  Warnings:

  - You are about to drop the `import_templates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "import_templates" DROP CONSTRAINT "import_templates_project_id_fkey";

-- DropTable
DROP TABLE "import_templates";
