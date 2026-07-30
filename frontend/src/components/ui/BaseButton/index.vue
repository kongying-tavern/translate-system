<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  plain?: boolean
  disabled?: boolean
  loading?: boolean
  link?: boolean
  size?: 'large' | 'default' | 'small'
  nativeType?: 'button' | 'submit' | 'reset'
  round?: boolean
  circle?: boolean
  text?: boolean
  bg?: boolean
  danger?: boolean
  icon?: string | object
}>(), {
  type: 'default',
  plain: false,
  disabled: false,
  loading: false,
  link: false,
  size: 'default',
  nativeType: 'button',
  round: false,
  circle: false,
  text: false,
  bg: false,
  danger: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<template>
  <el-button
    class="base-button"
    :type="type" :plain="plain" :disabled="disabled" :loading="loading"
    :link="link" :size="size" :native-type="nativeType"
    :round="round" :circle="circle" :text="text" :bg="bg"
    :danger="danger" :icon="icon"
    @click="handleClick"
  >
    <slot />
  </el-button>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
