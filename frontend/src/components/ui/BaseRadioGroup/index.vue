<script setup lang="ts" generic="T extends string | number | boolean">
import type { BaseRadioOption } from './types'

withDefaults(defineProps<{
  options: BaseRadioOption<T>[]
  button?: boolean
  size?: 'large' | 'default' | 'small'
  disabled?: boolean
}>(), {
  button: false,
  size: 'default',
  disabled: false,
})

const emit = defineEmits<{
  change: [value: T]
}>()

const modelValue = defineModel<T>()

function handleChange(value: T) {
  emit('change', value)
}
</script>

<template>
  <el-radio-group
    v-model="modelValue"
    class="base-radio-group" :size="size" :disabled="disabled"
    @change="handleChange"
  >
    <template v-if="button">
      <el-radio-button v-for="opt in options" :key="String(opt.value)" :value="opt.value" :disabled="opt.disabled">
        {{ opt.label }}
      </el-radio-button>
    </template>
    <el-radio v-for="opt in options" v-else :key="String(opt.value)" :value="opt.value" :disabled="opt.disabled">
      {{ opt.label }}
    </el-radio>
  </el-radio-group>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
