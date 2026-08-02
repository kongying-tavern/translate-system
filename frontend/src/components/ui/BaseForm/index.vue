<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ref } from 'vue'

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

const elFormRef = ref<FormInstance>()

defineExpose({
  validate: (...args: Parameters<FormInstance['validate']>) => elFormRef.value?.validate(...args),
  validateField: (...args: Parameters<FormInstance['validateField']>) => elFormRef.value?.validateField(...args),
  resetFields: (...args: Parameters<FormInstance['resetFields']>) => elFormRef.value?.resetFields(...args),
  clearValidate: (...args: Parameters<FormInstance['clearValidate']>) => elFormRef.value?.clearValidate(...args),
})
</script>

<template>
  <el-form
    ref="elFormRef"
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
