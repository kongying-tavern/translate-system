declare module 'sortablejs' {
  interface SortableInstance {
    destroy: () => void
  }

  interface SortableOptions {
    handle?: string
    animation?: number
    onEnd?: (evt: { oldIndex: number, newIndex: number }) => void
  }

  const Sortable: {
    create: (el: HTMLElement, options: SortableOptions) => SortableInstance
  }

  export default Sortable
}
