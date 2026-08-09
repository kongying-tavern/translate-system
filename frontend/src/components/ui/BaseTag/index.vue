<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'primary' | 'success' | 'info' | 'warning' | 'danger'
  size?: 'large' | 'default' | 'small'
  effect?: 'light' | 'dark' | 'plain'
  round?: boolean
  closable?: boolean
  disableTransitions?: boolean
}>(), {
  type: 'primary',
  size: 'default',
  effect: 'light',
  round: false,
  closable: false,
  disableTransitions: false,
})

const emit = defineEmits<{
  close: [event: MouseEvent]
}>()
</script>

<template>
  <el-tag
    class="base-tag"
    :type="type" :size="size" :effect="effect"
    :round="round" :closable="closable" :disable-transitions="disableTransitions"
    @close="emit('close', $event)"
  >
    <slot />
  </el-tag>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
