import { defineStore } from 'pinia'
import { ref } from 'vue'
import { encPathParam } from '@/utils/path'

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

  function closeLeft(path: string): string | null {
    const idx = tabs.value.findIndex(t => t.path === path)
    if (idx <= 0)
      return null
    const removedActive = tabs.value.slice(0, idx).some(t => t.path === activePath.value)
    tabs.value.splice(0, idx)
    return removedActive ? path : null
  }

  function closeRight(path: string): string | null {
    const idx = tabs.value.findIndex(t => t.path === path)
    if (idx === -1 || idx === tabs.value.length - 1)
      return null
    const removedActive = tabs.value.slice(idx + 1).some(t => t.path === activePath.value)
    tabs.value.splice(idx + 1)
    return removedActive ? path : null
  }

  function closeOthers(path: string): string | null {
    const target = tabs.value.find(t => t.path === path)
    if (!target)
      return null
    const removedActive = activePath.value !== path
    tabs.value = [target]
    return removedActive ? path : null
  }

  function reset(): void {
    tabs.value = []
    activePath.value = ''
  }

  function isProjectPath(path: string, slug: string): boolean {
    const enc = encPathParam(slug)
    return path === `/projects/${enc}` || path.startsWith(`/projects/${enc}/`)
  }

  function renameProjectSlug(oldSlug: string, newSlug: string): void {
    const oldEnc = encPathParam(oldSlug)
    const newEnc = encPathParam(newSlug)
    tabs.value = tabs.value.map((t) => {
      if (isProjectPath(t.path, oldSlug))
        return { ...t, path: t.path.replace(oldEnc, newEnc) }
      return t
    })
    if (isProjectPath(activePath.value, oldSlug))
      activePath.value = activePath.value.replace(oldEnc, newEnc)
  }

  function removeProjectTabs(slug: string): void {
    tabs.value = tabs.value.filter(t => !isProjectPath(t.path, slug))
    if (isProjectPath(activePath.value, slug))
      activePath.value = ''
  }

  return { tabs, activePath, addTab, removeTab, closeLeft, closeRight, closeOthers, reset, renameProjectSlug, removeProjectTabs }
})
