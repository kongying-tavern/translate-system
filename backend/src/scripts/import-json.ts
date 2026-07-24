import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const [,, projectId, filePath, languageCode] = process.argv

if (!projectId || !filePath || !languageCode) {
  console.error('Usage: npx tsx src/scripts/import-json.ts <projectId> <filePath> <languageCode>')
  console.error('Example: npx tsx src/scripts/import-json.ts <uuid> ../en-US.json en-US')
  process.exit(1)
}

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const entries = Object.entries(data)
  console.log('Importing ' + entries.length + ' entries -> project ' + projectId + ' [' + languageCode + ']')

  let count = 0
  for (const [key, value] of entries) {
    let translationKey = await prisma.translationKey.findUnique({
      where: { projectId_key: { projectId, key } }
    })
    if (!translationKey) {
      translationKey = await prisma.translationKey.create({
        data: { projectId, key, sourceText: key }
      })
    }
    await prisma.translationValue.upsert({
      where: { keyId_languageCode: { keyId: translationKey.id, languageCode } },
      update: { translatedText: String(value) },
      create: { keyId: translationKey.id, languageCode, translatedText: String(value) }
    })
    if (++count % 200 === 0) console.log('  ' + count + '/' + entries.length)
  }
  console.log('Done: ' + count + ' translations imported.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
