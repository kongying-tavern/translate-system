<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { BaseIcon } from '@/components/ui'

withDefaults(defineProps<{ description?: string }>(), { description: '暂无数据' })
</script>

<template>
  <div class="empty-state">
    <BaseIcon :size="64" color="#c0c4cc">
      <Document />
    </BaseIcon>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state { text-align: center; padding: 60px 0; color: #909399; }
.empty-state p { margin: 16px 0; }
</style>
