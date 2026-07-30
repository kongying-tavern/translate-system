<script setup lang="ts" generic="T, TItem">
const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  filterable?: boolean
  multiple?: boolean
  collapseTags?: boolean
  size?: 'large' | 'default' | 'small'

  options?: TItem[]
  labelKey?: string
  valueKey?: string
  labelGetter?: (item: TItem) => string
  valueGetter?: (item: TItem) => T
}>(), {
  disabled: false,
  clearable: false,
  filterable: false,
  multiple: false,
  collapseTags: false,
  size: 'default',
})

const emit = defineEmits<{
  change: [value: T]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  clear: []
  visibleChange: [visible: boolean]
}>()

const modelValue = defineModel<T>()

function getLabel(item: TItem): string {
  if (props.labelGetter)
    return props.labelGetter(item)
  if (props.labelKey)
    return (item as Record<string, unknown>)[props.labelKey] as string
  return String(item)
}
function getValue(item: TItem): T {
  if (props.valueGetter)
    return props.valueGetter(item)
  if (props.valueKey)
    return (item as Record<string, unknown>)[props.valueKey] as T
  return item as unknown as T
}

function handleChange(value: T) {
  emit('change', value)
}
function handleFocus(event: FocusEvent) {
  emit('focus', event)
}
function handleBlur(event: FocusEvent) {
  emit('blur', event)
}
function handleClear() {
  emit('clear')
}
function handleVisibleChange(visible: boolean) {
  emit('visibleChange', visible)
}
</script>

<template>
  <el-select
    v-model="modelValue"
    class="base-select" :placeholder="placeholder" :disabled="disabled"
    :clearable="clearable" :filterable="filterable" :multiple="multiple"
    :collapse-tags="collapseTags" :size="size"
    @change="handleChange" @focus="handleFocus" @blur="handleBlur"
    @clear="handleClear" @visible-change="handleVisibleChange"
  >
    <template v-if="options">
      <el-option v-for="item in options" :key="String(getValue(item))" :label="getLabel(item)" :value="getValue(item)" />
    </template>
    <slot v-else />
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>
    <template v-if="$slots.empty" #empty>
      <slot name="empty" />
    </template>
  </el-select>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
