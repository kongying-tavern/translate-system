<script setup lang="ts">
import type { ContextMenuItem } from '@/components/ui/BaseContextMenu/types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseContextMenu, BaseTabButton } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useTabsStore } from '@/stores/tabs'
import { decSlug } from '@/utils/slug'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()
const auth = useAuthStore()

function isStaticPath(path: string): boolean {
  if (!path)
    return false
  return router.resolve(path).meta.isStatic === true
}

function resolveTitleForPath(path: string): string {
  const resolved = router.resolve(path)
  const metaTitle = (resolved.meta.title as string | undefined) || path
  const projectSlug = resolved.params.projectSlug as string | undefined
  if (projectSlug)
    return `${metaTitle} · ${auth.activeProjectName || projectSlug}`
  return metaTitle
}

function resolveTitle(): string {
  return resolveTitleForPath(route.path)
}

watch(() => route.path, (path) => {
  tabsStore.activePath = path
  if (isStaticPath(path))
    return
  tabsStore.addTab({ path, title: resolveTitle() })
}, { immediate: true })

watch(() => auth.activeProjectName, () => {
  const activeSlug = auth.activeProjectSlug
  if (!activeSlug)
    return
  tabsStore.tabs = tabsStore.tabs.map((t) => {
    if (t.path.startsWith('/projects/') && decSlug(t.path.split('/')[2] ?? '') === activeSlug)
      return { ...t, title: resolveTitleForPath(t.path) }
    return t
  })
})

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
  const isStatic = isStaticPath(menuPath.value)
  const idx = tabsStore.tabs.findIndex(t => t.path === menuPath.value)
  const items: ContextMenuItem[] = []
  if (!isStatic)
    items.push({ key: 'close', label: '关闭标签页', onClick: () => closeCtxTab(menuPath.value) })
  if (!isStatic && idx > 0)
    items.push({ key: 'close-left', label: '关闭左侧', onClick: () => closeCtxLeft(menuPath.value) })
  if (isStatic ? tabsStore.tabs.length > 0 : idx < tabsStore.tabs.length - 1)
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
  if (isStaticPath(path)) {
    closeAllDynamic()
    return
  }
  navigate(tabsStore.closeRight(path))
}

function closeCtxOthers(path: string): void {
  if (isStaticPath(path)) {
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
      :active="route.path === '/'"
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
