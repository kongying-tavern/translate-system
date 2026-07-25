import 'js-yaml'

declare module 'js-yaml' {
  interface DumpOptions {
    quotingType?: '"' | '\''
    forceQuotes?: boolean
  }
}
