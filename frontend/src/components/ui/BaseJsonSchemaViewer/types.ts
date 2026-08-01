import type { JSONSchema } from 'cf-json-schema-viz'

/** JSON Schema 查看器属性 */
export interface BaseJsonSchemaViewerProps {
  /** JSON Schema 定义 */
  schema: JSONSchema | object
  /** 默认展开深度（未全展开时），0 表示仅展开根节点 */
  defaultExpandedDepth?: number
  /** 是否全部展开，优先于 defaultExpandedDepth */
  expanded?: boolean
  /** 是否禁用面包屑导航 */
  disableCrumbs?: boolean
  /** 是否渲染根节点树线 */
  renderRootTreeLines?: boolean
  /** 空数据提示文本 */
  emptyText?: string
}
