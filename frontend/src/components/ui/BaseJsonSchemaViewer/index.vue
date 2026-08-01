<script setup lang="ts">
import type { BaseJsonSchemaViewerProps } from './types'
import { JsonSchemaViewer } from 'cf-json-schema-viz'
import { applyPureReactInVue } from 'veaury'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import 'cf-json-schema-viz/styles.css'

const props = withDefaults(defineProps<BaseJsonSchemaViewerProps>(), {
  defaultExpandedDepth: 0,
  expanded: true,
  disableCrumbs: false,
  renderRootTreeLines: true,
  emptyText: '暂无 Schema 定义',
})

const containerRef = ref<HTMLDivElement | null>(null)
const containerHeight = ref<number | null>(null)

let observer: ResizeObserver | null = null

function measure(): void {
  containerHeight.value = containerRef.value ? containerRef.value.clientHeight : null
}

onMounted(() => {
  measure()
  if (containerRef.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

// veaury 桥接 React 组件到 Vue
const JsonSchemaViewerReact = applyPureReactInVue(JsonSchemaViewer)

/** 展开深度：expanded 优先于 defaultExpandedDepth */
const expandedDepth = computed(() => (props.expanded ? 999 : props.defaultExpandedDepth ?? 0))

/** 容器有实际高度时才透传 maxHeight，否则交给 React 端自动布局 */
const maxHeight = computed(() => (containerHeight.value && containerHeight.value > 0 ? containerHeight.value : undefined))

/** 生成 key 强制重建组件（veaury 桥接的 React 组件需要） */
const componentKey = computed(() =>
  JSON.stringify({
    schema: props.schema,
    defaultExpandedDepth: expandedDepth.value,
    maxHeight: maxHeight.value,
    disableCrumbs: props.disableCrumbs,
    renderRootTreeLines: props.renderRootTreeLines,
    emptyText: props.emptyText,
  }),
)
</script>

<template>
  <div ref="containerRef" class="base-json-schema-viewer">
    <JsonSchemaViewerReact
      :key="componentKey"
      :schema.camel="schema"
      :max-height.camel="maxHeight"
      :default-expanded-depth.camel="expandedDepth"
      :disable-crumbs.camel="disableCrumbs"
      :render-root-tree-lines.camel="renderRootTreeLines"
      :empty-text.camel="emptyText"
    />
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
