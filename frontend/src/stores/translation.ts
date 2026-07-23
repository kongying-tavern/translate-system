import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as translationApi from '@/api/translation'

export interface GroupedRow {
  translationKey: string; sourceText: string; context: string; tags: string[]; keyId: string
  translations: Record<string, { id: string; translatedText: string; isReviewed?: boolean; reviewerComment?: string }>
}

export const useTranslationStore = defineStore('translation', () => {
  const rows = ref<GroupedRow[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchTranslations(projectId: string, params: Record<string, any>) {
    loading.value = true
    try {
      const { data: res } = await translationApi.getTranslations(projectId, params)
      rows.value = res.data.list
      total.value = res.data.total
    } finally { loading.value = false }
  }

  async function create(projectId: string, data: any) {
    const { data: res } = await translationApi.createTranslation(projectId, data)
    return res.data.data
  }

  async function saveForLang(projectId: string, key: string, langCode: string, data: { translatedText?: string; tags?: string[]; context?: string }) {
    await translationApi.saveTranslation(projectId, key, langCode, data)
  }

  async function remove(projectId: string, id: string) {
    await translationApi.deleteTranslation(projectId, id)
  }

  return { rows, total, loading, fetchTranslations, create, saveForLang, remove }
})
