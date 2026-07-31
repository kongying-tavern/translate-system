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
}
