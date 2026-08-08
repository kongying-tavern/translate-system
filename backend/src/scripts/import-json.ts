import * as fs from 'node:fs'
import process from 'node:process'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const [,, projectSlug, filePath, languageCode] = process.argv

if (!projectSlug || !filePath || !languageCode) {
  console.error('Usage: pnpm tsx src/scripts/import-json.ts <projectId|projectCode> <filePath> <languageCode>')
  process.exit(1)
}

async function main() {
  // Resolve project: try UUID first, then code
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectSlug)
  let project = null
  if (isUUID)
    project = await prisma.project.findUnique({ where: { id: projectSlug } })
  if (!project)
    project = await prisma.project.findUnique({ where: { code: projectSlug } })
  if (!project) {
    console.error(`Project not found: ${projectSlug}`)
    process.exit(1)
  }
  const projectId = project.id

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const entries = Object.entries(data)
  console.log(`Importing ${entries.length} entries -> project ${projectSlug} [${languageCode}]`)

  let count = 0
  for (const [key, value] of entries) {
    let translationKey = await prisma.translationKey.findUnique({
      where: { projectId_key: { projectId, key } },
    })
    if (!translationKey) {
      const maxSo = await prisma.translationKey.aggregate({ where: { projectId }, _max: { sortOrder: true } })
      translationKey = await prisma.translationKey.create({
        data: { projectId, key, sortOrder: (maxSo._max.sortOrder || 0) + 100 },
      })
    }
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: translationKey.id, languageCode } },
      update: { translatedText: String(value) },
      create: { keyId: translationKey.id, languageCode, translatedText: String(value) },
    })
    if (++count % 200 === 0)
      console.log(`  ${count}/${entries.length}`)
  }
  console.log(`Done: ${count} translations imported.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
