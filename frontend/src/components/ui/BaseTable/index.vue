<script setup lang="ts" generic="T extends object">
import type { BaseTableColumnConfig } from './types'
import { h } from 'vue'

withDefaults(defineProps<{
  data?: T[]
  columns?: BaseTableColumnConfig<T>[]
  stripe?: boolean
  border?: boolean
  maxHeight?: string | number
  height?: string | number
  rowKey?: string
  highlightCurrentRow?: boolean
  size?: 'large' | 'default' | 'small'
  emptyText?: string
}>(), {
  stripe: false,
  border: false,
  highlightCurrentRow: false,
  size: 'default',
})

const emit = defineEmits<{
  selectionChange: [selection: T[]]
  rowClick: [row: unknown, column: object, event: Event]
  sortChange: [params: { column: object, prop: string, order: string }]
  rowDblclick: [row: unknown, column: object, event: Event]
}>()

function getCellValue(row: unknown, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function renderCell(row: unknown, col: BaseTableColumnConfig<T>, $index: number) {
  const val = col.dataKey ? getCellValue(row, col.dataKey) : undefined
  if (col.cell) {
    const result = col.cell(row as T, val, $index)
    if (result == null)
      return
    if (typeof result === 'string' || typeof result === 'number')
      return h('span', {}, result)
    return result
  }
  return h('span', {}, String(val ?? ''))
}

function handleSelectionChange(selection: T[]) {
  emit('selectionChange', selection)
}
function handleRowClick(row: unknown, column: object, event: Event) {
  emit('rowClick', row, column, event)
}
function handleSortChange(params: { column: object, prop: string, order: string }) {
  emit('sortChange', params)
}
function handleRowDblclick(row: unknown, column: object, event: Event) {
  emit('rowDblclick', row, column, event)
}
</script>

<template>
  <el-table
    class="base-table"
    :data="data" :stripe="stripe" :border="border"
    :max-height="maxHeight" :height="height" :row-key="rowKey"
    :highlight-current-row="highlightCurrentRow" :size="size"
    :empty-text="emptyText"
    @selection-change="handleSelectionChange"
    @row-click="handleRowClick"
    @sort-change="handleSortChange"
    @row-dblclick="handleRowDblclick"
  >
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
    <template v-if="$slots.empty" #empty>
      <slot name="empty" />
    </template>

    <template v-if="columns">
      <el-table-column
        v-for="col in columns" :key="col.dataKey || col.title"
        :type="col.type" :prop="col.dataKey" :label="col.title"
        :width="col.width" :min-width="col.minWidth" :fixed="col.fixed"
        :sortable="col.sortable" :align="col.align"
        :header-align="col.headerAlign"
        :show-overflow-tooltip="col.showOverflowTooltip"
      >
        <template #default="scope">
          <component :is="renderCell(scope.row, col, scope.$index)" />
        </template>
        <template v-if="col.header" #header>
          <component :is="col.header()" />
        </template>
      </el-table-column>
    </template>

    <slot v-else />
  </el-table>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
