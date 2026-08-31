<script setup lang='ts'>
import type { ScriptSubcommand } from '@/api/scripts'
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import { h } from 'vue'
import { BaseTable } from '@/components/ui'

defineOptions({ name: 'ScriptSubcommandBlock' })

const props = defineProps<{
  subcommands: ScriptSubcommand[]
  platform: 'ps1' | 'sh'
}>()

interface ParamRow {
  name: string
  type: string
  required: boolean
  default: string
  help: string
}

const paramColumns: BaseTableColumnConfig<ParamRow>[] = [
  { dataKey: 'name', title: '参数', width: 200, cell: (row: ParamRow) => h('span', { class: 'mono' }, row.name) },
  { dataKey: 'type', title: '类型', width: 80, cell: (row: ParamRow) => h('span', { class: 'mono' }, row.type) },
  { dataKey: 'required', title: '必填', width: 70, cell: (row: ParamRow) => (row.required ? h('span', { class: 'req-badge' }, '必填') : h('span', { class: 'opt-badge' }, '可选')) },
  { dataKey: 'default', title: '默认值', width: 100, cell: (row: ParamRow) => h('span', { class: 'mono' }, row.default) },
  { dataKey: 'help', title: '说明' },
]

function toParamRow(p: ScriptSubcommand['params'][number], plt: 'ps1' | 'sh'): ParamRow {
  const name = plt === 'ps1'
    ? (p.shortName ? `-${p.shortName}, -${p.ps1Name}` : `-${p.ps1Name}`)
    : (p.shortName ? `-${p.shortName}, --${p.shName}` : `--${p.shName}`)
  return {
    name,
    type: p.type,
    required: p.required,
    default: p.default != null ? String(p.default) : '-',
    help: p.help,
  }
}

function nodeKey(sc: ScriptSubcommand, index: number): string {
  return sc.name ? sc.name : `__${index}`
}
</script>

<template>
  <div class="subcommand-block">
    <template v-for="(sc, index) in props.subcommands" :key="nodeKey(sc, index)">
      <!-- 有子命令的节点：渲染全局参数（如有）+ 递归子命令 -->
      <template v-if="sc.subcommands && sc.subcommands.length">
        <div v-if="sc.params.length" class="global-params">
          <h4 class="section-subtitle">
            {{ sc.name ? sc.name : '全局参数' }}
          </h4>
          <BaseTable class="param-table" :data="sc.params.map(p => toParamRow(p, props.platform))" :columns="paramColumns" stripe size="small" />
        </div>
        <ScriptSubcommandBlock :subcommands="sc.subcommands ?? []" :platform="props.platform" />
      </template>
      <!-- 叶子节点：每个子命令独立卡片 -->
      <template v-else>
        <div class="subcommand-card">
          <div v-if="sc.name" class="subcommand-header">
            <code class="subcommand-name">{{ sc.name }}</code>
            <span v-if="sc.desc" class="subcommand-desc">{{ sc.desc }}</span>
          </div>
          <div v-if="sc.params.length" class="subcommand-params">
            <BaseTable class="param-table" :data="sc.params.map(p => toParamRow(p, props.platform))" :columns="paramColumns" stripe size="small" />
          </div>
          <p v-else-if="sc.name" class="no-params">
            无参数
          </p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.subcommand-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-subtitle {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.subcommand-card {
  background: #fafbfc;
  border: 1px solid #e8eaed;
  border-left: 3px solid #409eff;
  border-radius: 4px;
  padding: 12px 16px;
}

.subcommand-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.subcommand-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  border-radius: 3px;
  padding: 2px 8px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.subcommand-desc {
  font-size: 13px;
  color: #606266;
}

.no-params {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.req-badge,
.opt-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1.6;
}

.req-badge {
  color: #f56c6c;
  background-color: #fef0f0;
  border: 1px solid #fbc4c4;
}

.opt-badge {
  color: #909399;
  background-color: #f4f4f5;
  border: 1px solid #e9e9eb;
}

.param-table :deep(.el-table__cell) {
  font-size: 13.5px;
}

.param-table :deep(.mono) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
</style>
