<script setup lang="ts" generic="T">
import type { JSONDataType } from 'vue-json-pretty/types/utils'
import type { BaseJsonViewerProps } from './types'
import { computed } from 'vue'
import JsonViewer from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const props = withDefaults(defineProps<BaseJsonViewerProps<T>>(), {
  deep: undefined,
  collapsedNodeLength: undefined,
  showLength: true,
  showLine: true,
  showLineNumber: false,
  showIcon: true,
  showDoubleQuotes: false,
  virtual: false,
  height: 400,
  itemHeight: 20,
})

const renderValue = computed(() => props.value as unknown as JSONDataType)
</script>

<template>
  <JsonViewer
    class="base-json-viewer"
    :data="renderValue"
    :deep="deep"
    :collapsed-node-length="collapsedNodeLength"
    :show-length="showLength"
    :show-line="showLine"
    :show-line-number="showLineNumber"
    :show-icon="showIcon"
    :show-double-quotes="showDoubleQuotes"
    :virtual="virtual"
    :height="height"
    :item-height="itemHeight"
    theme="light"
  />
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>

<style lang="scss">
.base-json-viewer {
  .vjs-key { white-space: pre-wrap; word-break: break-all; }
  .vjs-value-string, .vjs-key-string { white-space: pre-wrap; word-break: break-all; }
}
</style>
