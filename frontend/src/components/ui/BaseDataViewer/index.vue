<script setup lang="ts">
import type { ViewerDisplayMode } from 'data-visor-vue'
import type { BaseDataViewerProps } from './types'
import { DataVisor } from 'data-visor-vue'
import 'data-visor-vue/style.css'

withDefaults(defineProps<BaseDataViewerProps>(), {
  lang: 'json',
  isDark: false,
  maxHeight: '600px',
  initialDepth: 2,
  showLineNumbers: true,
  showToolbar: true,
  showBreadcrumb: true,
  showFractured: false,
})

const emit = defineEmits<{
  'update:displayMode': [value: ViewerDisplayMode]
  'nodeClick': [node: unknown]
  'copy': [value: string]
  'searchChange': [query: string]
  'expansionChange': [expandedCount: number]
}>()

const displayMode = defineModel<ViewerDisplayMode>('displayMode')

function handleNodeClick(node: unknown) {
  emit('nodeClick', node)
}
function handleCopy(value: string) {
  emit('copy', value)
}
function handleSearchChange(query: string) {
  emit('searchChange', query)
}
function handleExpansionChange(expandedCount: number) {
  emit('expansionChange', expandedCount)
}
</script>

<template>
  <DataVisor
    v-model:display-mode="displayMode"
    class="base-data-viewer"
    :data="data" :lang="lang" :dark-theme="darkTheme" :light-theme="lightTheme"
    :is-dark="isDark" :max-height="maxHeight" :min-height="minHeight"
    :initial-depth="initialDepth" :show-line-numbers="showLineNumbers"
    :show-toolbar="showToolbar" :show-breadcrumb="showBreadcrumb"
    :show-fractured="showFractured"
    @node-click="handleNodeClick" @copy="handleCopy"
    @search-change="handleSearchChange" @expansion-change="handleExpansionChange"
  />
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
