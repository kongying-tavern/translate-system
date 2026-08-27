# 翻译页面关键逻辑

> 本篇说明翻译管理页的虚拟滚动、IME 守卫、排序与回归要点。

## 数据与渲染

- 后端 listGrouped 按 key 聚合，一条返回：translationKey + sourceText（= 源语言 value）+ context + tags + translations{}
- 原文列弹窗编辑保存，即更新源语言 value
- 弹窗编辑保存后通过 saveTranslation / updateKey API 更新并同步到本地 rows（无 transCache 行内缓存）；context 和 tags 是 key 级属性，不按语言缓存
- **列表渲染**：
  - TranslationListView.vue 一次加载全量（pageSize: -1，后端对 -1 按 1e9 处理）
  - 虚拟滚动：ElAutoResizer 测尺寸 + BaseTableVirtualized 封装
  - 固定行高 = rowHeightMult×20+4+20，存 localStorage trans-row-height；斑马纹开启、滚动时 :stripe="!scrolling" 禁用
  - 行是 position:absolute 虚拟渲染，行内 textarea autosize 会破坏固定行高
  - 因此所有编辑走弹窗：单元格截断文本 + Edit 图标 → expandDialog 720px；Key/原文/译文/标签/备注可编辑；原文框 max-height:420px
- **滚动降级机制（静态 div 方案）**：
  - 触发：onTableScroll 置 scrolling=true，停止滚动 600ms 后重置
  - 滚动中所有可编辑列换成纯静态 div、不挂交互组件，消除 ResizeObserver/slotchange 事件风暴
  - 降级形态：Key/原文/译文/备注用 StaticTextCell（外观同 BaseInput textarea）；语言列 .cell-static-lang；标签列折叠「+N」样式；操作列灰色「删除」占位
  - translationColumns computed 内 void scrolling.value 显式建依赖——cellRenderer 闭包里的读取不被追踪，必须这样才能在停止后重建 columns
  - is-scrolling 时禁用 transition 与 user-select（行 hover 过渡是卡顿主因）
  - 未启用 useIsScrolling：实测其值每帧 nextTick 重置造成 cache 抖动，降级完全靠手写 debounce
- **textarea 原生滚轮**：
  - el-table-v2 在滚动容器冒泡阶段挂 wheel 监听，非边缘滚动一律 preventDefault，会吞掉弹窗内多行 textarea 的滚动
  - 表格容器已加捕获阶段 @wheel.capture="onWheelCapture"：目标是可滚动 textarea（scrollHeight > clientHeight）时 stopPropagation() 放行原生滚动
- **标签列**：行内 BaseTagInput collapseTags 折叠成「+N」，防溢出固定行高
- Edit 图标打开标签弹窗全量编辑；保存时去重 / trim / 过滤空值后走 PUT .../translations/{keyId}，并刷新候选标签
- 编辑类保存全部走 keyId 定位，Key 改名不影响缓存键
- member 仅可编辑译文列
- **IME 组合守卫**：
  - 行内编辑 blur 保存统一走 handleBlurSave；BaseInput 透传 compositionstart/end 维护 composing 标志，组合中途失焦不触发本次保存
  - 译文列取值兜底为行当前值，避免把空串当新值覆盖
  - Safari 已知问题：compositionend 晚于 blur 时该次编辑延迟到下次交互再存，数据不丢仅延迟
- 仅未翻译：后端过滤该语言 translatedText 为空或不存在；#行号（支持 #3 与 #3-8 区间）与 /正则/ 搜索在前端对全量 rows 过滤（#行号 时后端不传 search，按全局 rowIndex 匹配）
- 筛选条件（标签/搜索/仅未翻译）同时启用以 AND 组合；多标签之间 OR
- **行排序机制**：
  - sortOrder 默认从 0 开始；listGrouped 按 sortOrder asc, key asc 排序；rowIndex 为过滤前全局序号（#行号搜索依赖其稳定）
  - 新增 key 分配 maxSo + 100 步长，为折半插入留空位
  - 同屏拖拽用数据驱动 pointer 实现（Sortablejs 无法用于 el-table-v2）：
    - pointerdown 记起点 → pointermove 按 dy/ROW_HEIGHT 折合目标行，实时 splice 重排 rows 并重写 rowIndex → pointerup 保存 so = Math.round((prevSo + nxtSo) / 2)
    - 配合 scrollTop/tableHeight 计算可视区间：只允许同屏拖拽、禁止跨区
  - 间距耗尽时从相邻最小值整页重排（base + (i+1)*10）；只允许同屏拖拽、禁止跨区
  - 跨屏插入：定位图标打开 insertDialog，输入目标行号 + 之前/之后，复用相同折半逻辑与 sortOrders PUT 保存；行号越界弹警告
  - 存量数据由 20260808030000_backfill_key_sort_order 迁移重排——勿用 db:push 绕过

## 翻译管理页测试要点（keyid 化回归）

1. **特殊字符 Key**：含 `/`、空格、中文等字符的 Key，改名/原文/标签/备注/译文保存均正常，改名后同行其余列仍可编辑
2. **首尾空格原样保存**：Key、原文、译文均不 trim——编辑（新增/行内改名/弹窗改名）与导入均原样保存，前后端仅做非空白校验（纯空白 Key 拒绝）
3. **权限**：member 仅可编辑译文列（其余不可编辑、无操作列、无拖拽/插入图标）；maintainer/admin 全列可编辑；member 越权调用后端拒绝返回中文提示
4. **新增 Key**：对话框无原文输入框，创建后原文列为空，可在原文列弹窗编辑
5. **原文保护**：译文保存不影响源语言原文；源语言不在翻译目标语言中
6. **列表交互**：语言切换仅改显示不刷新；「仅未翻译」开启时切换才刷新
   - 虚拟滚动流畅、固定行高无跳动；拖拽只限同屏、禁跨区
   - 滚动时降级静态 div，停止 600ms 恢复；行高 4 档切换即时生效并存 localStorage trans-row-height；高档顶对齐、内边距变大
7. **跨屏插入**：仅无筛选时显示定位图标 → 弹窗输入目标行号 + 之前/之后；越界警告；目标=当前行直接关闭；member 无图标；插入后顺序保持
8. **textarea 滚轮**：弹窗内多行 textarea 滚轮只在框内滚动不被表格吞掉；未超长时滚轮仍滚表格
9. **标签折叠与弹窗**：collapseTags 折叠不溢出行高；Edit 弹窗全量编辑，保存后行内/候选刷新；标签列可编辑权限下才有图标
10. **导入锁**：导入进行中打开翻译管理页顶部警告条且所有写操作禁用（新增/删除 Key、编辑各列、拖拽、跨屏插入均不可见/不可触发，可编辑列回退只读）；锁状态全员跨标签页实时生效，导入结束约 2s 自动解锁
11. **条目锁定**：Maintainer+ 可在操作列点击锁图标切换锁定状态；锁定后 member 译文列降级只读（不可编辑/不可弹窗），Maintainer+ 不受影响；后端同步拒绝 member 越权保存译文并返回中文提示；滚动期间锁图标显示 🔒 占位
