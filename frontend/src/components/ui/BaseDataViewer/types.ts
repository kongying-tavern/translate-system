import type { DataVisorProps } from 'data-visor-vue'

export type DataViewerLang = NonNullable<DataVisorProps['lang']>

export interface BaseDataViewerProps {
  data: string
  lang?: DataViewerLang
  darkTheme?: DataVisorProps['darkTheme']
  lightTheme?: DataVisorProps['lightTheme']
  isDark?: boolean
  maxHeight?: string
  minHeight?: string
  initialDepth?: number
  showLineNumbers?: boolean
  showToolbar?: boolean
  showBreadcrumb?: boolean
  /** 是否显示 Fractured（分块）模式按钮，默认隐藏（仅 json 有此模式） */
  showFractured?: boolean
}
