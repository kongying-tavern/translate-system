<script setup lang="ts">
import { BaseButton, BaseDialog } from '@/components/ui'

defineProps<{ title: string, message: string }>()
defineEmits<{ confirm: [], cancel: [] }>()
const visible = defineModel<boolean>('visible', { required: true })
</script>

<template>
  <BaseDialog v-model="visible" :title="title" width="400px" @close="$emit('cancel')">
    <p>{{ message }}</p>
    <template #footer>
      <BaseButton @click="$emit('cancel')">
        取消
      </BaseButton>
      <BaseButton type="danger" @click="$emit('confirm')">
        确认
      </BaseButton>
    </template>
  </BaseDialog>
</template>
