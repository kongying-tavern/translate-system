<script setup lang="ts">
withDefaults(defineProps<{
  /** 提示类型，对应 el-alert 的 type */
  type?: 'success' | 'warning' | 'info' | 'error'
  /** 标题文本，留空时可改用 #title 插槽渲染富文本 */
  title?: string
  /** 是否可关闭，关闭时 emit close */
  closable?: boolean
  /** 是否显示大图标（默认开启，统一提示视觉） */
  showIcon?: boolean
  /** 多行说明，逐行渲染为 .base-notice__lines 列表；与默认插槽可共存 */
  lines?: string[]
}>(), {
  type: 'info',
  title: '',
  closable: true,
  showIcon: true,
  lines: () => [],
})

const emit = defineEmits<{
  close: []
}>()
function onClose() {
  emit('close')
}
</script>

<template>
  <el-alert
    class="base-notice"
    :type="type"
    :title="title"
    :closable="closable"
    :show-icon="showIcon"
    @close="onClose"
  >
    <template v-if="$slots.title" #title>
      <slot name="title" />
    </template>
    <template v-if="lines.length || $slots.default" #default>
      <div v-if="lines.length" class="base-notice__lines">
        <div v-for="(line, i) in lines" :key="i">
          {{ line }}
        </div>
      </div>
      <slot />
    </template>
  </el-alert>
</template>

<style lang="scss" scoped>
@use './reset.scss';
@use './style.scss';
</style>
