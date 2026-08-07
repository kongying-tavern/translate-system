<script setup lang="ts">
import BaseSelect from '../BaseSelect/index.vue'

withDefaults(defineProps<{
  options: string[]
  placeholder?: string
  size?: 'large' | 'default' | 'small'
  clearable?: boolean
  disabled?: boolean
  collapseTags?: boolean
  reserveKeyword?: boolean
}>(), {
  placeholder: '选择或输入标签',
  size: 'default',
  clearable: true,
  disabled: false,
  collapseTags: false,
  reserveKeyword: true,
})

const emit = defineEmits<{
  change: [value: string[]]
}>()

const modelValue = defineModel<string[]>({ required: true })
</script>

<template>
  <BaseSelect
    v-model="modelValue"
    class="base-tag-input"
    :options="options"
    :placeholder="placeholder"
    :size="size"
    :clearable="clearable"
    :disabled="disabled"
    :collapse-tags="collapseTags"
    :reserve-keyword="reserveKeyword"
    multiple
    filterable
    allow-create
    default-first-option
    @change="emit('change', $event)"
  />
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
