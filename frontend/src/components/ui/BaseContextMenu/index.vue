<script setup lang="ts">
import type { BaseContextMenuProps, ContextMenuItem } from './types'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<BaseContextMenuProps>()

const emit = defineEmits<{
  select: [key: string]
}>()

const visible = defineModel<boolean>('visible', { default: false })

const menuRef = ref<HTMLDivElement | null>(null)
const pos = ref({ x: props.x, y: props.y })

let teardown: (() => void) | null = null

function close(): void {
  visible.value = false
}

function onDocClick(e: MouseEvent): void {
  const el = menuRef.value
  if (el && e.target instanceof Node && el.contains(e.target))
    return
  close()
}

function onDocContextMenu(): void {
  close()
}

function onDocWheel(): void {
  close()
}

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape')
    close()
}

function registerListeners(): void {
  teardown?.()
  document.addEventListener('click', onDocClick)
  document.addEventListener('contextmenu', onDocContextMenu)
  document.addEventListener('wheel', onDocWheel)
  document.addEventListener('keydown', onDocKeydown)
  teardown = () => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('contextmenu', onDocContextMenu)
    document.removeEventListener('wheel', onDocWheel)
    document.removeEventListener('keydown', onDocKeydown)
  }
}

function unregisterListeners(): void {
  teardown?.()
  teardown = null
}

async function reposition(): Promise<void> {
  const el = menuRef.value
  if (!el)
    return
  const pad = 8
  const x = Math.max(0, Math.min(props.x, window.innerWidth - el.offsetWidth - pad))
  const y = Math.max(0, Math.min(props.y, window.innerHeight - el.offsetHeight - pad))
  pos.value = { x, y }
}

watch(visible, async (v) => {
  if (v) {
    pos.value = { x: props.x, y: props.y }
    registerListeners()
    await nextTick()
    await reposition()
  }
  else {
    unregisterListeners()
  }
}, { immediate: true })

watch(() => [props.x, props.y], () => {
  if (visible.value) {
    pos.value = { x: props.x, y: props.y }
    void reposition()
  }
})

function handleItemClick(item: ContextMenuItem): void {
  if (item.disabled)
    return
  emit('select', item.key)
  item.onClick?.()
  close()
}

onBeforeUnmount(() => unregisterListeners())
</script>

<template>
  <div v-if="visible" ref="menuRef" class="base-context-menu" :style="{ left: `${pos.x}px`, top: `${pos.y}px` }">
    <template v-for="item in items" :key="item.key">
      <div v-if="item.divided" class="base-context-menu__divider" />
      <div
        class="base-context-menu__item"
        :class="{ 'is-disabled': item.disabled, 'is-danger': item.danger }"
        @click="handleItemClick(item)"
      >
        <span v-if="item.label">{{ item.label }}</span>
        <component :is="item.render()" v-else-if="item.render" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
