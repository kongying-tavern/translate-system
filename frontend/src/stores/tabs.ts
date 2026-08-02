import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabItem {
  path: string
  title: string
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([])
  const activePath = ref('')

  function addTab(tab: TabItem): void {
    if (!tabs.value.some(t => t.path === tab.path))
      tabs.value.push(tab)
    activePath.value = tab.path
  }

  function removeTab(path: string): string | null {
    const idx = tabs.value.findIndex(t => t.path === path)
    if (idx === -1)
      return null
    const wasActive = activePath.value === path
    tabs.value.splice(idx, 1)
    if (!wasActive)
      return null
    const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
    return next ? next.path : null
  }

  function reset(): void {
    tabs.value = []
    activePath.value = ''
  }

  return { tabs, activePath, addTab, removeTab, reset }
})
