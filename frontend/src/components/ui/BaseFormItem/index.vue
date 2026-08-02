<script setup lang="ts">
import type { FormItemRule } from 'element-plus'

withDefaults(defineProps<{
  label?: string
  prop?: string
  required?: boolean
  rules?: FormItemRule | FormItemRule[]
  error?: string
  showMessage?: boolean
  size?: 'large' | 'default' | 'small'
  labelWidth?: string | number
}>(), {
  required: undefined,
  showMessage: true,
})
</script>

<template>
  <el-form-item
    class="base-form-item" :label="label" :prop="prop" :required="required"
    :rules="rules" :error="error" :show-message="showMessage"
    :size="size" :label-width="labelWidth"
  >
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>
    <template v-if="$slots.error" #error>
      <slot name="error" />
    </template>
    <slot />
  </el-form-item>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
