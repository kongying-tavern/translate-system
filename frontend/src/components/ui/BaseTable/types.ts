import type { VNode } from 'vue'

export interface BaseTableColumnConfig<T = unknown> {
  dataKey?: string
  title?: string
  width?: string | number
  minWidth?: string | number
  fixed?: 'left' | 'right'
  sortable?: boolean | 'custom'
  align?: 'left' | 'center' | 'right'
  headerAlign?: 'left' | 'center' | 'right'
  showOverflowTooltip?: boolean
  type?: 'selection' | 'index' | 'expand'
  cell?: (rowData: T, cellData: unknown, index: number) => VNode | string | number | null | undefined
  header?: () => VNode | string | null | undefined
}
