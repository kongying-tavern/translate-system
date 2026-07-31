export interface BaseRadioOption<T> {
  label: string
  value: T
  disabled?: boolean
}

export interface BaseRadioGroupProps<T> {
  options: BaseRadioOption<T>[]
  button?: boolean
  size?: 'large' | 'default' | 'small'
  disabled?: boolean
}
