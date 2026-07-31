<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  width?: string | number
  fullscreen?: boolean
  top?: string
  closeOnClickModal?: boolean
  draggable?: boolean
  showClose?: boolean
}>(), {
  fullscreen: false,
  closeOnClickModal: true,
  draggable: false,
  showClose: true,
})

const emit = defineEmits<{
  open: []
  close: []
  opened: []
  closed: []
}>()

const modelValue = defineModel<boolean>('modelValue', { default: false })

function handleOpen() {
  emit('open')
}
function handleClose() {
  emit('close')
}
function handleOpened() {
  emit('opened')
}
function handleClosed() {
  emit('closed')
}
</script>

<template>
  <el-dialog
    v-model="modelValue"
    class="base-dialog" :title="title" :width="width"
    :fullscreen="fullscreen" :top="top"
    :close-on-click-modal="closeOnClickModal" :draggable="draggable"
    :show-close="showClose"
    @open="handleOpen" @close="handleClose"
    @opened="handleOpened" @closed="handleClosed"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <slot />
  </el-dialog>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
