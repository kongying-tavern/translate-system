import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as langApi from '@/api/language'
import type { BaseLanguage, ProjectLanguage } from '@/types/models'
import languagesData from '@/data/languages.json'

export const useLanguageStore = defineStore('language', () => {
  const baseLanguages = ref<BaseLanguage[]>(languagesData as BaseLanguage[])
  const projectLanguages = ref<ProjectLanguage[]>([])

  async function fetchProjectLanguages(projectId: string) {
    const { data: res } = await langApi.getProjectLanguages(projectId)
    projectLanguages.value = res.data
  }

  async function addLanguage(projectId: string, languageCode: string) {
    const { data: res } = await langApi.addProjectLanguage(projectId, languageCode)
    projectLanguages.value.push(res.data)
  }

  async function removeLanguage(projectId: string, languageCode: string) {
    await langApi.removeProjectLanguage(projectId, languageCode)
    projectLanguages.value = projectLanguages.value.filter(l => l.languageCode !== languageCode)
  }

  function getBaseName(code: string): string {
    const lang = baseLanguages.value.find(l => l.languageCode === code)
    return lang ? lang.englishName + ' (' + (lang.nativeName || '') + ')' : code
  }

  return { baseLanguages, projectLanguages, fetchProjectLanguages, addLanguage, removeLanguage, getBaseName }
})
