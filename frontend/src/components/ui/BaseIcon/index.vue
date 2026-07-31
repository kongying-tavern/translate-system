<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
  color?: string
}>(), {
})
</script>

<template>
  <el-icon class="base-icon" :size="size" :color="color">
    <slot />
  </el-icon>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
