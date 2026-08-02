<script setup lang="ts">
import type { ContextMenuItem } from '@/components/ui/BaseContextMenu/types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseContextMenu, BaseTabButton } from '@/components/ui'
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

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  tabsStore.reset()
})

const menuVisible = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const menuPath = ref('')
const tabsBarRef = ref<HTMLDivElement | null>(null)
const menuAnchorEl = ref<HTMLElement | null>(null)

const ctxItems = computed<ContextMenuItem[]>(() => {
  const isHome = menuPath.value === '/'
  const idx = tabsStore.tabs.findIndex(t => t.path === menuPath.value)
  const items: ContextMenuItem[] = []
  if (!isHome)
    items.push({ key: 'close', label: '关闭标签页', onClick: () => closeCtxTab(menuPath.value) })
  if (!isHome && idx > 0)
    items.push({ key: 'close-left', label: '关闭左侧', onClick: () => closeCtxLeft(menuPath.value) })
  if (isHome ? tabsStore.tabs.length > 0 : idx < tabsStore.tabs.length - 1)
    items.push({ key: 'close-right', label: '关闭右侧', onClick: () => closeCtxRight(menuPath.value) })
  if (tabsStore.tabs.length > 1)
    items.push({ key: 'close-others', label: '关闭其他', onClick: () => closeCtxOthers(menuPath.value) })
  return items
})

function computeMenuPos(): { x: number, y: number } {
  const x = menuAnchorEl.value?.getBoundingClientRect().left ?? 0
  let y = 0
  const bar = tabsBarRef.value
  if (bar) {
    const rect = bar.getBoundingClientRect()
    y = rect.bottom - 2
  }
  return { x, y }
}

function openMenu(path: string, e: MouseEvent): void {
  menuPath.value = path
  menuAnchorEl.value = e.currentTarget as HTMLElement
  if (ctxItems.value.length === 0)
    return
  menuPos.value = computeMenuPos()
  menuVisible.value = true
}

function onWindowResize(): void {
  if (menuVisible.value)
    menuPos.value = computeMenuPos()
}

watch(menuVisible, (v) => {
  if (v)
    window.addEventListener('resize', onWindowResize)
  else
    window.removeEventListener('resize', onWindowResize)
})

function navigate(next: string | null): void {
  if (next)
    router.push(next)
  else if (tabsStore.tabs.length === 0)
    router.push('/')
}

function handleTabClick(path: string): void {
  if (path !== route.path)
    router.push(path)
}

function handleHomeClick(): void {
  if (route.path !== '/')
    router.push('/')
}

function handleTabClose(path: string): void {
  menuVisible.value = false
  navigate(tabsStore.removeTab(path))
}

function closeCtxTab(path: string): void {
  navigate(tabsStore.removeTab(path))
}

function closeCtxLeft(path: string): void {
  navigate(tabsStore.closeLeft(path))
}

function closeCtxRight(path: string): void {
  if (path === '/') {
    closeAllDynamic()
    return
  }
  navigate(tabsStore.closeRight(path))
}

function closeCtxOthers(path: string): void {
  if (path === '/') {
    closeAllDynamic()
    return
  }
  navigate(tabsStore.closeOthers(path))
}

function closeAllDynamic(): void {
  const removedActive = tabsStore.tabs.some(t => t.path === tabsStore.activePath)
  tabsStore.tabs = []
  tabsStore.activePath = ''
  if (removedActive)
    router.push('/')
}
</script>

<template>
  <div ref="tabsBarRef" class="app-tabs">
    <BaseTabButton
      label="首页"
      :active="route.path === '/' || route.path === '/projects'"
      @click="handleHomeClick"
      @contextmenu.prevent.stop="openMenu('/', $event)"
    />
    <BaseTabButton
      v-for="tab in tabsStore.tabs" :key="tab.path"
      :label="tab.title" :active="tab.path === tabsStore.activePath"
      closable
      @click="handleTabClick(tab.path)" @close="handleTabClose(tab.path)"
      @contextmenu.prevent.stop="openMenu(tab.path, $event)"
    />
    <BaseContextMenu v-model:visible="menuVisible" :items="ctxItems" :x="menuPos.x" :y="menuPos.y" />
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
