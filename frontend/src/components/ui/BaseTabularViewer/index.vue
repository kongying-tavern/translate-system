<script setup lang="ts">
import type { BaseTabularViewerProps, TabularSize, TabularViewMode } from './types'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { BaseButton, BaseCheckbox, BaseIcon, BaseRadioGroup } from '@/components/ui'

const props = withDefaults(defineProps<BaseTabularViewerProps>(), {
  format: 'csv',
  maxHeight: '400px',
  useFirstRowAsHeader: true,
  showGridLines: true,
})

const mode = defineModel<TabularViewMode>('mode', { default: 'table' })
const wrap = defineModel<boolean>('wrap', { default: true })

const modeOptions = [
  { label: '表格', value: 'table' as TabularViewMode },
  { label: '原文', value: 'raw' as TabularViewMode },
]

/** 视图尺寸（small/default/large）：默认中，可受控传入 */
const size = defineModel<TabularSize>('size', { default: 'default' })

/** 兼容带引号字段、内嵌逗号/换行/双引号转义的 CSV 拆分（RFC 4180） */
function csvSplit(data: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  while (i < data.length) {
    const ch = data[i]
    if (quoted) {
      if (ch === '"') {
        if (data[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      }
      else {
        field += ch
      }
    }
    else if (ch === '"') {
      quoted = true
    }
    else if (ch === ',') {
      fields.push(field)
      field = ''
    }
    else if (ch === '\n') {
      fields.push(field)
      field = ''
      records.push(fields)
      fields = []
    }
    else {
      field += ch
    }
    i++
  }
  fields.push(field)
  if (fields.some(f => f.trim()))
    records.push(fields)
  return records
}

/** Properties 解析：每行 key=value 或 key: value，跳过空行和 #/! 注释，取第一个未转义分隔符 */
function propertiesToRows(data: string): string[][] {
  const records: string[][] = []
  const separator = /(?<!\\)[=:]/
  for (const line of data.split('\n')) {
    const trimmed = line.trimStart()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!'))
      continue
    const idx = line.search(separator)
    if (idx === -1) {
      records.push([line, ''])
      continue
    }
    records.push([line.slice(0, idx).trimEnd(), line.slice(idx + 1).trimStart()])
  }
  return records
}

const records = computed<string[][]>(() => {
  const normalized = props.data.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (props.format === 'properties')
    return propertiesToRows(normalized)
  return csvSplit(normalized)
})

const header = computed<string[]>(() => {
  if (props.format === 'properties')
    return ['键', '值']
  if (!props.useFirstRowAsHeader)
    return []
  return records.value[0] ?? []
})

const rows = computed<string[][]>(() => {
  return props.useFirstRowAsHeader && props.format === 'csv' ? records.value.slice(1) : records.value
})

const columnCount = computed(() => {
  let max = 0
  for (const row of [header.value, ...rows.value]) {
    if (row.length > max)
      max = row.length
  }
  return max
})

const hasData = computed(() => rows.value.length > 0)

async function copyData() {
  try {
    await navigator.clipboard.writeText(props.data)
    ElMessage.success('已复制')
  }
  catch {
    ElMessage.error('复制失败，请手动选择复制')
  }
}
</script>

<template>
  <div class="base-tabular-viewer">
    <div class="base-tabular-viewer__toolbar">
      <BaseRadioGroup v-model="mode" button :size="size" :options="modeOptions" />
      <BaseCheckbox v-if="mode === 'table'" v-model="wrap" :size="size" class="base-tabular-viewer__wrap-toggle">
        自动换行
      </BaseCheckbox>
      <div class="base-tabular-viewer__toolbar-spacer" />
      <BaseButton :size="size" @click="copyData">
        <BaseIcon><CopyDocument /></BaseIcon>
        复制
      </BaseButton>
    </div>

    <template v-if="mode === 'table'">
      <div class="base-tabular-viewer__table-wrap" :style="{ maxHeight }">
        <table
          class="base-tabular-viewer__table"
          :class="{
            'base-tabular-viewer__table--grid': showGridLines,
            'base-tabular-viewer__table--wrap': wrap,
            'base-tabular-viewer__table--small': size === 'small',
            'base-tabular-viewer__table--large': size === 'large',
          }"
        >
          <thead v-if="header.length">
            <tr>
              <th v-for="(c, i) in header" :key="i" scope="col">
                {{ c }}
              </th>
              <th v-for="n in Math.max(0, columnCount - header.length)" :key="`pad-${n}`" scope="col" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in rows" :key="r">
              <td v-for="i in columnCount" :key="i" :class="{ 'base-tabular-viewer__cell--empty': !(row[i - 1] ?? '').trim() }">
                {{ row[i - 1] ?? '' }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!hasData" class="base-tabular-viewer__empty">
          暂无数据
        </div>
      </div>
    </template>
    <pre
      v-else
      class="base-tabular-viewer__raw"
      :class="{
        'base-tabular-viewer__raw--small': size === 'small',
        'base-tabular-viewer__raw--large': size === 'large',
      }"
      :style="{ maxHeight }"
    >{{ data }}</pre>
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
