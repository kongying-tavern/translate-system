<script setup lang="ts">
import { Tools } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { managerDownload } from '@/api/scripts'
import { BaseIcon } from '@/components/ui'
import OsDownloadCard from './OsDownloadCard.vue'

const platforms = [
  { key: 'win', label: 'Windows' },
  { key: 'linux', label: 'Linux' },
  { key: 'mac', label: 'macOS' },
] as const

async function handleDownload(p: (typeof platforms)[number]['key']) {
  try {
    const res = await managerDownload(p)
    if (!res.available)
      ElMessage.warning('脚本管理器暂未提供该平台版本')
  }
  catch {
    ElMessage.error('下载脚本管理器失败')
  }
}
</script>

<template>
  <div class="manager-hero">
    <div class="manager-icon">
      <BaseIcon :size="72">
        <Tools />
      </BaseIcon>
    </div>
    <h2 class="manager-title">
      脚本管理器
    </h2>
    <p class="manager-desc">
      脚本管理器是一个用于管理脚本的命令行工具（CLI），支持脚本的下载 / 比对 / 更新。<br>
      选择对应操作系统版本下载。
    </p>
  </div>
  <div class="manager-platforms">
    <OsDownloadCard
      v-for="p in platforms"
      :key="p.key"
      :platform="p.key"
      :label="p.label"
      @download="handleDownload(p.key)"
    />
  </div>
  <p class="manager-tip">
    暂未开放，即将提供。
  </p>
</template>

<style scoped>
.manager-hero { text-align: center; }
.manager-icon { display: flex; justify-content: center; color: #409eff; }
.manager-title { margin: 16px 0 8px; font-size: 22px; font-weight: 600; color: #303133; }
.manager-desc { margin: 0; font-size: 13px; color: #606266; }
.manager-platforms { display: flex; gap: 24px; margin-top: 40px; }
.manager-tip { margin-top: 20px; font-size: 12px; color: #909399; }
</style>
