# Base UI 组件体系

> 本篇说明 Base UI 的封装规范与全部组件速查。

## 封装原则

- 目的：统一样式入口便于换肤和全局扩展——**不是为了减少使用量**，页面里的任何第三方 / 原生 UI 组件都必须经 Base 封装层使用（不限于 Element Plus，React 桥接组件同理）
- 目录：`src/components/ui/<Name>/`，经 `@/components/ui` barrel 使用，禁止深路径 import
- 文件：`index.vue` + `style.scss`（自定义样式，可改）；有 EP 间距修正的另有 `reset.scss`（不可改）

## 编码规则

- 显式 defineProps + withDefaults + defineModel + defineEmits；不用 v-bind="$attrs"
- scoped 内 `@use './reset.scss'; @use './style.scss';`（Dart Sass 已弃用 @import）
- 子组件内部元素必须 `:deep()` 才能命中
- 新增组件：迁移现有使用处 + 更新速查表 + 导出到 ui/index.ts
- 父组件 ref 类型：useTemplateRef<ComponentExposed<typeof Child>>('xx')，不能用 InstanceType

## 透传类组件

| 组件 | 对应 EP | 要点 |
|------|---------|------|
| BaseButton | el-button | 常规透传 |
| BaseCheckbox | el-checkbox | defineModel + label slot |
| BaseDialog | el-dialog | defineModel |
| BaseIcon | el-icon | hover 动画 |
| BaseInput | el-input | autosize、type=password；透传 compositionstart/end（IME 守卫） |
| BaseLink | el-link | type 默认 default；13px，相邻间距 12px |
| BaseNotice | el-alert | showIcon 默认 true；lines 多行数组 |
| BasePageHeader | el-page-header | #extra 放右侧操作 |
| BaseTag | el-tag | closable 时 emit close |
| BaseTabButton | 自绘 | label/active/closable + click/close |
| BaseForm(-Item) | el-form(-item) | validate 等 4 方法经 defineExpose 暴露 |
| BaseTableVirtualized | el-table-v2 | 泛型虚拟滚动表格；透传 columns/data/rowHeight/stripe 等；#empty/#footer 插槽 |
| BaseJsonSchemaViewer | cf-json-schema-viz | React 经 veaury 桥接；嵌套 $ref 先 dereferenceSchema |

## 配置式组件

| 组件 | 配置要点 |
|------|----------|
| BaseSelect | options + labelKey/valueKey 或 Getter。**传对象数组必须给 key，否则显示 [object Object]** |
| BaseRadioGroup | options(label,value,disabled)；button prop 切按钮样式 |
| BaseTabs | tabs 配置 + #tab-{key} 插槽 |
| BaseTable | columns 配置驱动，cell 用 TSX（@vitejs/plugin-vue-jsx） |
| BaseTagInput | 多选标签输入器；逗号/分号/回车/Tab 确认新标签；点击已选=移除，确认键重名=跳过 |
| BaseContextMenu | items 配置右键菜单；v-model:visible + x/y；自动视口收拢 |
| BaseDataViewer | data-visor-vue 查看 json/yaml/xml；Fractured 默认隐藏；依赖有 pnpm patch（5 处） |
| BaseTabularViewer | csv/properties 解析表格；表格/原文切换、自动换行、复制；三档字号 |
