<script setup lang="ts" generic="T extends string">
import type { BaseTabsProps } from './types'

const props = withDefaults(defineProps<BaseTabsProps<T>>(), {
  tabs: () => [],
  type: '',
})

const emit = defineEmits<{
  tabClick: [tab: T]
  tabRemove: [tab: T]
}>()

const modelValue = defineModel<T>()

function handleTabClick(pane: { props?: { name?: string } }) {
  emit('tabClick', pane.props?.name as unknown as T)
}

function handleTabRemove(name: string) {
  emit('tabRemove', name as T)
}

function isActive(key: T): boolean {
  return modelValue.value === key
}

function goTo(selector: T | number | (T | number)[]): void {
  const list = Array.isArray(selector) ? selector : [selector]
  for (const s of list) {
    const tab = typeof s === 'number'
      ? props.tabs[s < 0 ? props.tabs.length + s : s]
      : props.tabs.find(t => t.key === s)
    if (tab) {
      modelValue.value = tab.key
      return
    }
  }
  modelValue.value = props.tabs[props.tabs.length - 1]?.key ?? '' as T
}

defineExpose({ goTo })
</script>

<template>
  <div class="base-tabs-wrapper">
    <div class="base-tabs-header">
      <el-tabs
        v-model="modelValue"
        class="base-tabs"
        :type="type === '' ? undefined : type"
        @tab-click="handleTabClick"
        @tab-remove="handleTabRemove"
      >
        <el-tab-pane
          v-for="tab in tabs" :key="tab.key"
          :name="tab.key" :label="tab.label"
          :closable="tab.closable"
        />
      </el-tabs>
      <div v-if="$slots.extra" class="base-tabs-extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="base-tabs-content">
      <template v-for="tab in tabs" :key="tab.key">
        <div v-show="isActive(tab.key)" class="base-tab-pane">
          <slot :name="`tab-${tab.key}`" />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
