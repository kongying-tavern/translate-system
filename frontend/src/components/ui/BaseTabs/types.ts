export interface BaseTabItem<T extends string> {
  key: T
  label: string
  closable?: boolean
}

export interface BaseTabsProps<T extends string> {
  tabs: BaseTabItem<T>[]
  type?: 'card' | 'border-card' | ''
}
