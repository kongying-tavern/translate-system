import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const languages = [
  { languageCode: 'af-ZA', englishName: 'Afrikaans', nativeName: 'Afrikaans' },
  { languageCode: 'ar-SA', englishName: 'Arabic', nativeName: 'العربية' },
  { languageCode: 'bg-BG', englishName: 'Bulgarian', nativeName: 'български' },
  { languageCode: 'ca-ES', englishName: 'Catalan', nativeName: 'català' },
  { languageCode: 'cs-CZ', englishName: 'Czech', nativeName: 'čeština' },
  { languageCode: 'da-DK', englishName: 'Danish', nativeName: 'dansk' },
  { languageCode: 'de-DE', englishName: 'German', nativeName: 'Deutsch' },
  { languageCode: 'el-GR', englishName: 'Greek', nativeName: 'Ελληνικά' },
  { languageCode: 'en-US', englishName: 'English (US)', nativeName: 'English (US)' },
  { languageCode: 'en-GB', englishName: 'English (UK)', nativeName: 'English (UK)' },
  { languageCode: 'es-ES', englishName: 'Spanish (Spain)', nativeName: 'español (España)' },
  { languageCode: 'es-MX', englishName: 'Spanish (Mexico)', nativeName: 'español (México)' },
  { languageCode: 'et-EE', englishName: 'Estonian', nativeName: 'eesti' },
  { languageCode: 'fa-IR', englishName: 'Persian', nativeName: 'فارسی' },
  { languageCode: 'fi-FI', englishName: 'Finnish', nativeName: 'suomi' },
  { languageCode: 'fr-FR', englishName: 'French', nativeName: 'français' },
  { languageCode: 'fr-CA', englishName: 'French (Canada)', nativeName: 'français (Canada)' },
  { languageCode: 'he-IL', englishName: 'Hebrew', nativeName: 'עברית' },
  { languageCode: 'hi-IN', englishName: 'Hindi', nativeName: 'हिन्दी' },
  { languageCode: 'hr-HR', englishName: 'Croatian', nativeName: 'hrvatski' },
  { languageCode: 'hu-HU', englishName: 'Hungarian', nativeName: 'magyar' },
  { languageCode: 'id-ID', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { languageCode: 'it-IT', englishName: 'Italian', nativeName: 'italiano' },
  { languageCode: 'ja-JP', englishName: 'Japanese', nativeName: '日本語' },
  { languageCode: 'ko-KR', englishName: 'Korean', nativeName: '한국어' },
  { languageCode: 'lt-LT', englishName: 'Lithuanian', nativeName: 'lietuvių' },
  { languageCode: 'lv-LV', englishName: 'Latvian', nativeName: 'latviešu' },
  { languageCode: 'ms-MY', englishName: 'Malay', nativeName: 'Bahasa Melayu' },
  { languageCode: 'nb-NO', englishName: 'Norwegian Bokmål', nativeName: 'Norsk bokmål' },
  { languageCode: 'nl-NL', englishName: 'Dutch', nativeName: 'Nederlands' },
  { languageCode: 'pl-PL', englishName: 'Polish', nativeName: 'polski' },
  { languageCode: 'pt-BR', englishName: 'Portuguese (Brazil)', nativeName: 'português (Brasil)' },
  { languageCode: 'pt-PT', englishName: 'Portuguese (Portugal)', nativeName: 'português (Portugal)' },
  { languageCode: 'ro-RO', englishName: 'Romanian', nativeName: 'română' },
  { languageCode: 'ru-RU', englishName: 'Russian', nativeName: 'русский' },
  { languageCode: 'sk-SK', englishName: 'Slovak', nativeName: 'slovenčina' },
  { languageCode: 'sl-SI', englishName: 'Slovenian', nativeName: 'slovenščina' },
  { languageCode: 'sr-RS', englishName: 'Serbian', nativeName: 'српски' },
  { languageCode: 'sv-SE', englishName: 'Swedish', nativeName: 'svenska' },
  { languageCode: 'th-TH', englishName: 'Thai', nativeName: 'ไทย' },
  { languageCode: 'tr-TR', englishName: 'Turkish', nativeName: 'Türkçe' },
  { languageCode: 'uk-UA', englishName: 'Ukrainian', nativeName: 'українська' },
  { languageCode: 'vi-VN', englishName: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { languageCode: 'zh-Hans', englishName: 'Chinese (Simplified)', nativeName: '简体中文' },
  { languageCode: 'zh-Hant', englishName: 'Chinese (Traditional)', nativeName: '繁體中文' },
]

async function main() {
  console.log('Seeding languages...')
  for (const lang of languages) {
    await prisma.baseLanguage.upsert({
      where: { languageCode: lang.languageCode },
      update: lang,
      create: lang,
    })
  }
  console.log(`Done - ${languages.length} languages seeded.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
