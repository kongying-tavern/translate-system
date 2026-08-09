<script setup lang="ts" generic="T extends object">
import type { Column, RowClassNameGetter } from 'element-plus'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** 列配置（element-plus ElTableV2 Column 数组） */
  columns?: Column<T>[]
  /** 表格数据 */
  data?: T[]
  /** 表格宽度 */
  width?: number
  /** 表格高度 */
  height?: number
  /** 行高（px） */
  rowHeight?: number
  /** 表头高度（px，支持数组实现多级表头） */
  headerHeight?: number | number[]
  /** 行 key 字段名 */
  rowKey?: string
  /** 是否启用固定列（配合 column.fixed） */
  fixed?: boolean
  /** 行 class（字符串或按参数计算） */
  rowClass?: string | RowClassNameGetter<T>
  /** 表头 class */
  headerClass?: string
  /** 渲染缓存行数（超出可视区的预渲染行数） */
  cache?: number
  /** 滚动条常显 */
  scrollbarAlwaysOn?: boolean
  /** 垂直滚动条宽度（px） */
  verticalScrollbarSize?: number
  /** 水平滚动条高度（px） */
  horizontalScrollbarSize?: number
  /** 是否开启滚动状态标记（cellRenderer 可收到 isScrolling） */
  useIsScrolling?: boolean
  /** 斑马纹（隔行变色） */
  stripe?: boolean
  /** 加载中遮罩 */
  loading?: boolean
}>(), {
  columns: () => [],
  data: () => [],
  rowHeight: 50,
  headerHeight: 50,
  rowKey: 'id',
  fixed: false,
  cache: 2,
  scrollbarAlwaysOn: false,
  verticalScrollbarSize: 6,
  horizontalScrollbarSize: 6,
  useIsScrolling: false,
  stripe: false,
  loading: false,
})

const emit = defineEmits<{
  scroll: [params: { scrollLeft: number, scrollTop: number }]
  rowsRendered: [params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }]
  endReached: [distance: number]
}>()

function handleScroll(params: { scrollLeft: number, scrollTop: number }) {
  emit('scroll', params)
}
function handleRowsRendered(params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }) {
  emit('rowsRendered', params)
}
function handleEndReached(distance: number) {
  emit('endReached', distance)
}

const scrollbarSizeProps = computed(() => ({
  'v-scrollbar-size': props.verticalScrollbarSize,
  'h-scrollbar-size': props.horizontalScrollbarSize,
}))

const tableRef = ref()

function scrollToRow(row: number, strategy?: 'auto' | 'start' | 'center' | 'end') {
  tableRef.value?.scrollToRow?.(row, strategy)
}
defineExpose({ scrollToRow })
</script>

<template>
  <ElTableV2
    ref="tableRef"
    v-loading="loading"
    class="base-table-virtualized"
    :columns="columns" :data="data" :width="width" :height="height"
    :row-height="rowHeight" :header-height="headerHeight" :row-key="rowKey"
    :fixed="fixed" :row-class="rowClass" :header-class="headerClass"
    :cache="cache" :scrollbar-always-on="scrollbarAlwaysOn"
    v-bind="scrollbarSizeProps"
    :use-is-scrolling="useIsScrolling"
    :on-scroll="handleScroll" :on-rows-rendered="handleRowsRendered"
    :on-end-reached="handleEndReached"
  >
    <template v-if="$slots.empty" #empty>
      <slot name="empty" />
    </template>
    <template v-if="$slots.default" #footer>
      <slot />
    </template>
  </ElTableV2>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
