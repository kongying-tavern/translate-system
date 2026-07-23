import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const [,, projectId, filePath, languageCode] = process.argv

if (!projectId || !filePath || !languageCode) {
  console.error('Usage: npx tsx src/scripts/import-json.ts <projectId> <filePath> <languageCode>')
  process.exit(1)
}

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const entries = Object.entries(data)
  console.log(`Importing ${entries.length} entries → project ${projectId} [${languageCode}]`)

  let count = 0
  for (const [key, value] of entries) {
    await prisma.translation.upsert({
      where: { projectId_languageCode_translationKey: { projectId, languageCode, translationKey: key } },
      update: { sourceText: key, translatedText: String(value) },
      create: { projectId, languageCode, translationKey: key, sourceText: key, translatedText: String(value) },
    })
    if (++count % 200 === 0) console.log(`  ${count}/${entries.length}`)
  }
  console.log(`Done: ${count} translations imported.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
