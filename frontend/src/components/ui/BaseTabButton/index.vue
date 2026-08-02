<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import BaseIcon from '../BaseIcon/index.vue'

withDefaults(defineProps<{
  label?: string
  active?: boolean
  closable?: boolean
}>(), {
  active: false,
  closable: false,
})

const emit = defineEmits<{
  click: []
  close: []
}>()
</script>

<template>
  <div class="base-tab-button" :class="{ 'is-active': active }" @click="emit('click')">
    <span v-if="label" class="base-tab-button__label">{{ label }}</span>
    <slot />
    <BaseIcon v-if="closable" class="base-tab-button__close" @click.stop="emit('close')">
      <Close />
    </BaseIcon>
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
