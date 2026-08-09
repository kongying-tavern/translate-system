<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | ''
  size?: 'large' | 'default' | 'small'
  truncated?: boolean
  lineClamp?: number | string
  tag?: string
}>(), {
  type: '',
  size: 'default',
  truncated: false,
})
</script>

<template>
  <el-text
    class="base-text"
    :type="type" :size="size" :truncated="truncated"
    :line-clamp="lineClamp" :tag="tag"
  >
    <slot />
  </el-text>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
