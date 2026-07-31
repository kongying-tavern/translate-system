export interface BaseJsonViewerProps<T> {
  value: T
  deep?: number
  collapsedNodeLength?: number
  showLength?: boolean
  showLine?: boolean
  showLineNumber?: boolean
  showIcon?: boolean
  showDoubleQuotes?: boolean
  virtual?: boolean
  height?: number
  itemHeight?: number
}
