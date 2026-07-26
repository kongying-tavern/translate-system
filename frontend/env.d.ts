declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const Component: DefineComponent<unknown, unknown, Record<string, unknown>>
  export default Component
}
