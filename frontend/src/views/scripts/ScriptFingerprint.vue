<script setup lang="ts">
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { BaseButton } from '@/components/ui'

const props = defineProps<{ sha256: string }>()

async function copy() {
  try {
    await navigator.clipboard.writeText(props.sha256)
    ElMessage.success('指纹复制成功')
  }
  catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <div class="fingerprint-section">
    <h4 class="section-title">
      脚本指纹
    </h4>
    <div class="file-info">
      <div class="fingerprint-row">
        <code class="sha256">{{ sha256 }}</code>
        <BaseButton class="copy-btn" type="primary" :icon="CopyDocument" @click="copy" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title { margin: 0 0 8px; font-size: 14px; color: #303133; }
.file-info { background-color: #f5f7fa; background-image: repeating-linear-gradient(45deg, rgba(0,0,0,.015) 0 6px, transparent 6px 12px); border: 1px solid #e4e7ed; border-radius: 6px; padding: 10px 14px; }
.fingerprint-row { display: flex; align-items: center; gap: 10px; }
.fingerprint-row .sha256 { flex: 1; font-size: 11px; word-break: break-all; font-family: 'JetBrains Mono', Consolas, monospace; }
.copy-btn { flex-shrink: 0; }
</style>
