<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  size?: 'large' | 'default' | 'small'
  underline?: boolean
  disabled?: boolean
  href?: string
  icon?: string | object
}>(), {
  type: 'primary',
  size: 'default',
  underline: true,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<template>
  <el-link
    class="base-link"
    :type="type" :underline="underline" :disabled="disabled"
    :size="size" :href="href" :icon="icon"
    @click="handleClick"
  >
    <slot />
  </el-link>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
