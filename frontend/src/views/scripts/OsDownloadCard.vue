<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { OsIcon } from '@/components/common'
import { BaseIcon } from '@/components/ui'

defineProps<{ platform: 'win' | 'linux' | 'mac', label: string }>()
const emit = defineEmits<{ download: [] }>()
</script>

<template>
  <div class="os-card" @click="emit('download')">
    <div class="os-card-icon">
      <OsIcon :platform="platform" :size="48" />
    </div>
    <div class="os-card-label">
      {{ label }}
    </div>
    <div class="os-card-download">
      <BaseIcon :size="14">
        <Download />
      </BaseIcon>
      <span>下载</span>
    </div>
  </div>
</template>

<style scoped>
.os-card { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px; padding: 28px 16px; background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; cursor: pointer; transition: all .2s; }
.os-card:hover { border-color: #409eff; box-shadow: 0 4px 14px rgba(64, 158, 255, .15); transform: translateY(-2px); }
.os-card-icon { color: #303133; }
.os-card-label { margin-top: 14px; font-size: 15px; font-weight: 600; color: #303133; }
.os-card-download { display: flex; align-items: center; gap: 4px; margin-top: 14px; font-size: 13px; color: #409eff; }
</style>
