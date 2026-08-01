<script setup lang="ts">
import type { FormRules } from 'element-plus'

withDefaults(defineProps<{
  model?: object
  rules?: FormRules
  inline?: boolean
  labelWidth?: string | number
  labelPosition?: 'left' | 'right' | 'top'
  size?: 'large' | 'default' | 'small'
  disabled?: boolean
}>(), {
  inline: false,
  disabled: false,
})
</script>

<template>
  <el-form
    class="base-form" :model="model" :rules="rules" :inline="inline"
    :label-width="labelWidth" :label-position="labelPosition"
    :size="size" :disabled="disabled"
  >
    <slot />
  </el-form>
</template>

<style lang="scss" scoped>
@use './reset.scss';
@use './style.scss';
</style>
