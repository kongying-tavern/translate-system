import type { VNode } from 'vue'

export interface ContextMenuItem {
  key: string
  label?: string
  danger?: boolean
  disabled?: boolean
  divided?: boolean
  render?: () => VNode
  onClick?: () => void
}

export interface BaseContextMenuProps {
  items: ContextMenuItem[]
  x: number
  y: number
}
