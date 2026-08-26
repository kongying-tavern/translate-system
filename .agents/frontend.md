# 前端分层与关键文件

> 本篇说明前端分层、stores/project.ts 的职责与关键文件。Base 组件规范见 [base-ui.md](base-ui.md)。

## 分层调用链

```
views/ → stores/ → api/ → Express (/api/v1/*)
```

- 布局：`layouts/AuthLayout`（登录注册卡片）、`layouts/AppLayout`（Header + AppTabs 标签栏 + 内容区）
- 公共组件统一从 `@/components/common` barrel 引入，禁止深路径 import：
  - AppHeader —— 项目切换 + 设置
  - AppSidebar —— 菜单 + 权限可见性
  - AppTabs —— 基于 BaseTabButton；首位固定「首页」标签；右键菜单只显示可执行操作，不可操作用隐藏而非禁用

## project store

- 所有项目只存 `stores/project.ts`：projects 数组 + bySlug map（key = slug，即 `code || id`）
- `auth.init()` 启动加载一次（loaded 守卫）；activeProjectName / projectRole 都是从 map 派生的 computed
- 项目增删改必须走 store（create / update / remove），保证 map 一致
- 项目 code 变更时三连同步：更新 activeProjectSlug → tabsStore.renameProjectSlug 重写标签路径 → router.replace 新 slug
- logout 时 projectStore.clear() 防串号

## 关键文件速查

| 文件 | 职责 |
|------|------|
| stores/auth.ts | 用户信息、系统角色、activeProjectSlug；token 主动刷新 + 每 30s 权限轮询（后台标签页跳过）；logout 一并停止 |
| stores/project.ts | 项目列表单数据源（bySlug 派生 projectRole 数据权限） |
| stores/translation.ts | 翻译列表、GroupedRow 类型 |
| stores/loading.ts | 全局 loading 遮罩 |
| stores/tabs.ts | 标签页集合；renameProjectSlug / removeProjectTabs 维护项目路径一致性 |
| hooks/useProjectPermission.ts | 权限 computed 都从这里取（菜单/功能/数据三类） |
| api/client.ts | Axios 实例；401 自动 refresh；业务错误（HTTP 200 但 code≠0）统一 reject 并携带 response |
| api/tokenRefresh.ts | 并发刷新只发一次请求、其余复用结果；过期前 30s 主动刷新；storage 跨标签页协同；旋转竞态守卫。access TTL 仅 15min |
| router/index.ts | 守卫 + auth.init()；meta.isStatic 固定标签；meta.perm URL 直达拦截 |

## 相关分册

- [base-ui.md](base-ui.md) —— Element Plus 封装规范与组件全表
- [permissions.md](permissions.md) —— 权限矩阵
- [slug.md](slug.md) —— Slug 与路径编码
