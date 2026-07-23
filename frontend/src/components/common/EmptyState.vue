<template>
  <div class="empty-state">
    <el-icon :size="64" color="#c0c4cc"><Document /></el-icon>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
withDefaults(defineProps<{ description?: string }>(), { description: '暂无数据' })
</script>

<style scoped>
.empty-state { text-align: center; padding: 60px 0; color: #909399; }
.empty-state p { margin: 16px 0; }
</style>
