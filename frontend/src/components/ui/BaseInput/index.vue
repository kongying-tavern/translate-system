<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'text' | 'textarea'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  size?: 'large' | 'default' | 'small'
  rows?: number
  maxlength?: number
  showWordLimit?: boolean
  autosize?: { minRows?: number, maxRows?: number } | boolean
}>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  clearable: false,
  size: 'default',
})

const emit = defineEmits<{
  change: [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  clear: []
  input: [value: string]
  compositionstart: [event: CompositionEvent]
  compositionend: [event: CompositionEvent]
}>()

const modelValue = defineModel<string>('modelValue', { default: '' })

function handleInput(value: string) {
  emit('input', value)
}
function handleChange(value: string) {
  emit('change', value)
}
function handleFocus(event: FocusEvent) {
  emit('focus', event)
}
function handleBlur(event: FocusEvent) {
  emit('blur', event)
}
function handleCompositionStart(event: CompositionEvent) {
  emit('compositionstart', event)
}
function handleCompositionEnd(event: CompositionEvent) {
  emit('compositionend', event)
}
function handleClear() {
  emit('clear')
}
</script>

<template>
  <el-input
    v-model="modelValue"
    class="base-input" :type="type" :placeholder="placeholder"
    :disabled="disabled" :readonly="readonly" :clearable="clearable"
    :size="size" :rows="rows" :maxlength="maxlength"
    :show-word-limit="showWordLimit"
    @input="handleInput" @change="handleChange"
    @focus="handleFocus" @blur="handleBlur" @clear="handleClear"
    @compositionstart="handleCompositionStart" @compositionend="handleCompositionEnd"
  >
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>
    <template v-if="$slots.suffix" #suffix>
      <slot name="suffix" />
    </template>
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
  </el-input>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
