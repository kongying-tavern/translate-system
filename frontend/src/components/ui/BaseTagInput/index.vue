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

function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return
  }
  const key = event.key
  const isConfirm = key === ',' || key === '，' || key === ';' || key === '；' || key === 'Tab'
  if (!isConfirm) {
    return
  }
  const input = event.target as HTMLInputElement | null
  const text = input?.value?.trim() ?? ''
  if (!text) {
    if (key !== 'Tab') {
      event.preventDefault()
    }
    return
  }
  if (!modelValue.value.includes(text)) {
    const next = [...modelValue.value, text]
    modelValue.value = next
    emit('change', next)
  }
  if (input) {
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  event.preventDefault()
  event.stopPropagation()
}
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
    @keydown="handleKeydown"
  />
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
