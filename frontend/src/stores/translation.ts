import type { CreateTranslationData, GroupedRow, TranslationQuery } from '@/api/translation'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as translationApi from '@/api/translation'

export const useTranslationStore = defineStore('translation', () => {
  const rows = ref<GroupedRow[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchTranslations(projectId: string, params: TranslationQuery) {
    loading.value = true
    try {
      const { data: res } = await translationApi.getTranslations(projectId, params)
      rows.value = res.data.list
      total.value = res.data.total
    }
    finally { loading.value = false }
  }

  async function create(projectId: string, data: CreateTranslationData) {
    await translationApi.createTranslation(projectId, data)
  }

  async function remove(projectId: string, id: string) {
    await translationApi.deleteTranslation(projectId, id)
  }

  return { rows, total, loading, fetchTranslations, create, remove }
})
