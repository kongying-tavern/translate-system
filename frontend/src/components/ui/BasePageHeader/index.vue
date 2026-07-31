<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: '',
})
</script>

<template>
  <div class="base-page-header">
    <h2>{{ title }}</h2>
    <div v-if="$slots.extra" class="base-page-header-extra">
      <slot name="extra" />
    </div>
    <slot />
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
