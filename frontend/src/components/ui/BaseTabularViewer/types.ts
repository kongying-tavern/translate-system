export type TabularFormat = 'csv' | 'properties'

export type TabularViewMode = 'table' | 'raw'

/** 表格显示尺寸（单元格疏密） */
export type TabularSize = 'small' | 'default' | 'large'

export interface BaseTabularViewerProps {
  /** 类表格文本（如 CSV、Properties 原文） */
  data: string
  /** 数据格式，决定表格模式下的解析方式 */
  format?: TabularFormat
  /** 最大高度，容器内部滚动 */
  maxHeight?: string
  /** 当前视图模式，支持 v-model:mode 双向绑定 */
  mode?: TabularViewMode
  /** 表格尺寸（小/中/大），支持 v-model:size 双向绑定；默认中，同时作用于工具栏切换标签/自动换行/复制按钮与原文视图 */
  size?: TabularSize
  /** 是否将首行作为表头（仅 csv） */
  useFirstRowAsHeader?: boolean
  /** 是否显示列间竖线 */
  showGridLines?: boolean
  /** 单元格是否自动换行，支持 v-model:wrap 双向绑定 */
  wrap?: boolean
}
