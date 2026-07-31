<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean
  indeterminate?: boolean
  size?: 'large' | 'default' | 'small'
}>(), {
  disabled: false,
  indeterminate: false,
  size: 'default',
})

const emit = defineEmits<{
  change: [value: boolean | string | number]
}>()

const modelValue = defineModel<boolean | string | number>('modelValue', { default: false })

function handleChange(value: boolean | string | number) {
  emit('change', value)
}
</script>

<template>
  <el-checkbox
    v-model="modelValue"
    class="base-checkbox" :disabled="disabled" :indeterminate="indeterminate"
    :size="size"
    @change="handleChange"
  >
    <slot />
  </el-checkbox>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
