<script setup lang="ts">
import type { ScriptInfo } from '@/api/scripts'
import type { BaseTabItem } from '@/components/ui'
import { Tools } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import { listScripts } from '@/api/scripts'
import { BaseIcon, BasePageHeader, BaseTabs } from '@/components/ui'
import ScriptFingerprint from './ScriptFingerprint.vue'
import ScriptManagerHero from './ScriptManagerHero.vue'
import ScriptSubcommandBlock from './ScriptSubcommandBlock.vue'
import ScriptUsagePanel from './ScriptUsagePanel.vue'

const loading = ref(false)
const scripts = ref<ScriptInfo[]>([])
const activeTab = ref('manager')
const platform = ref<'ps1' | 'sh'>('ps1')
const platformTabs: BaseTabItem<'ps1' | 'sh'>[] = [
  { key: 'ps1', label: 'PowerShell' },
  { key: 'sh', label: 'Bash' },
]
onMounted(async () => {
  loading.value = true
  try {
    scripts.value = await listScripts()
  }
  catch {
    ElMessage.error('加载脚本列表失败')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="scripts-page">
    <BasePageHeader title="脚本管理" />

    <el-tabs v-model="activeTab" tab-position="left" class="script-tabs">
      <el-tab-pane name="manager">
        <template #label>
          <span class="manager-tab-label"><BaseIcon><Tools /></BaseIcon> 脚本管理器</span>
        </template>
        <div class="pane-body manager-body">
          <ScriptManagerHero />
        </div>
      </el-tab-pane>

      <el-tab-pane v-for="s in scripts" :key="s.id" :label="s.name" :name="s.id">
        <div class="pane-body">
          <!-- 固定区：标题 + 描述 + 安装/使用方式 -->
          <div class="detail-fixed-top">
            <div class="usage-header">
              <h3 class="usage-title">
                {{ s.name }}
              </h3>
            </div>
            <p class="usage-desc">
              {{ s.description }}
            </p>

            <ScriptUsagePanel />
          </div>

          <!-- 滚动区：平台 tab + 参数 + 指纹 -->
          <div class="detail-scroll-area">
            <BaseTabs v-model="platform" :tabs="platformTabs" class="detail-platform-tabs">
              <template #tab-ps1>
                <div class="usage-section">
                  <h4 class="section-title">
                    参数
                  </h4>
                  <ScriptSubcommandBlock :subcommands="s.subcommands" platform="ps1" />
                </div>
                <ScriptFingerprint :sha256="s.platforms.ps1.sha256" />
              </template>
              <template #tab-sh>
                <div class="usage-section">
                  <h4 class="section-title">
                    参数
                  </h4>
                  <ScriptSubcommandBlock :subcommands="s.subcommands" platform="sh" />
                </div>
                <ScriptFingerprint :sha256="s.platforms.sh.sha256" />
              </template>
            </basetabs>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.scripts-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.scripts-page :deep(.script-tabs) {
  flex: 1;
  min-height: 0;
}

.scripts-page :deep(.script-tabs .el-tabs__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scripts-page :deep(.script-tabs .el-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pane-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.detail-fixed-top {
  flex: 0 0 auto;
}

.detail-scroll-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.manager-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 48px;
}

.manager-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.usage-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.usage-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 16px;
}

.detail-platform-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-platform-tabs :deep(.base-tabs-header) {
  flex: 0 0 auto;
}

.detail-platform-tabs :deep(.base-tabs-content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.usage-section {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 8px;
  font-size: 14px;
  color: #303133;
}
</style>
