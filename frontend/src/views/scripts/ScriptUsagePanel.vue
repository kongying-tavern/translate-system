<script setup lang="ts">
import type { BaseTabItem } from '@/components/ui'
import { ref } from 'vue'
import { BaseTabs } from '@/components/ui'

const active = ref<'install' | 'usage'>('install')
const tabs: BaseTabItem<'install' | 'usage'>[] = [
  { key: 'install', label: '安装方式' },
  { key: 'usage', label: '使用方式' },
]
</script>

<template>
  <BaseTabs v-model="active" :tabs="tabs" class="usage-panel-tabs">
    <template #tab-install>
      <p class="panel-text">
        请通过<strong>脚本管理器</strong>安装（脚本管理 → 下载首页）。安装命令格式暂定，待脚本管理器发布后补充。
      </p>
    </template>
    <template #tab-usage>
      <p class="panel-text">
        运行命令格式暂定，待脚本管理器发布后补充。
      </p>
    </template>
  </BaseTabs>
</template>

<style scoped>
.usage-panel-tabs {
  margin-bottom: 16px;
}

.panel-text {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
</style>
