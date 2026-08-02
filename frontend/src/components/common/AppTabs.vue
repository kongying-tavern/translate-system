<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseTabButton } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useTabsStore } from '@/stores/tabs'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()
const auth = useAuthStore()

const IGNORE_PATHS = new Set(['/', '/projects'])

function resolveTitle(): string {
  const metaTitle = (route.meta.title as string | undefined) || route.path
  const projectSlug = route.params.projectSlug as string | undefined
  if (projectSlug)
    return `${metaTitle} · ${auth.activeProjectName || projectSlug}`
  return metaTitle
}

watch(() => route.path, (path) => {
  tabsStore.activePath = path
  if (IGNORE_PATHS.has(path))
    return
  tabsStore.addTab({ path, title: resolveTitle() })
}, { immediate: true })

onBeforeUnmount(() => tabsStore.reset())

function handleTabClick(path: string): void {
  if (path !== route.path)
    router.push(path)
}

function handleTabClose(path: string): void {
  const next = tabsStore.removeTab(path)
  if (next)
    router.push(next)
  else if (tabsStore.tabs.length === 0)
    router.push('/')
}
</script>

<template>
  <div class="app-tabs">
    <BaseTabButton
      v-for="tab in tabsStore.tabs" :key="tab.path"
      :label="tab.title" :active="tab.path === tabsStore.activePath"
      :closable="tabsStore.tabs.length > 1"
      @click="handleTabClick(tab.path)" @close="handleTabClose(tab.path)"
    />
  </div>
</template>

<style lang="scss" scoped>
.app-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 6px 12px;
  border-bottom: 1px solid #e4e7ed;
  overflow-x: auto;
  white-space: nowrap;
}
</style>
