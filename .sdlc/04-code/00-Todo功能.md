# Todo 功能实现说明

> 需求名称：Todo功能
> 需求编号：00
> 日期：2026-09-20
> 状态：实现完成；目标测试通过，完整发布验收未完成
> 关联：[PRD](../01-prd/00-Todo功能.md) ｜ [设计](../02-design/00-Todo功能.md) ｜ [评审](../03-review/00-Todo功能.md) ｜ [测试](../05-test/00-Todo功能.md) ｜ [发布](../06-deploy/00-Todo功能.md)

## 1. 实施前实现现状（历史）

第 2–7 节登记实施前现状与历史记录；当前实现与验证结论以第 8 节为准。历史实现说明日期为 2026-09-10、状态“已完成”，并记录完整质量门禁受既有 `NativeChatTaskList.tsx` React Doctor 问题阻断；该历史事实保留，不转换为当前验证结果。

## 2. 代码链路

| 能力 | 实现位置 | 当前行为 |
| --- | --- | --- |
| Tab 注册与加载 | `src/renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx:12-33` | 以 lazy 面板渲染 Todo；切离 Tab 时卸载。 |
| 任务面板与 scope | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:48-380` | Project/Global 切换、加载、智能视图、CRUD 动作分发。 |
| 列表导航 | `src/renderer/src/components/right-sidebar/TodoNavigation.tsx:66-249` | 智能视图、创建、行内重命名、3 秒二次点击删除。 |
| 任务行与编辑 | `src/renderer/src/components/right-sidebar/TodoItemRow.tsx:29-178`、`src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:67-335` | 完成、编辑、删除、日期、提醒、我的一天、步骤。 |
| Renderer store | `src/renderer/src/store/slices/todos/create-todos-slice.ts:9-28` | 项目/全局缓存、actions、invalidation；初始 scope=project。 |
| bridge/类型 | `src/preload/api/todo-bridge.ts:18-72`、`src/preload/api/project-links-todos-api.ts:49-89` | todo IPC 方法及变更订阅类型。 |
| 主进程 handler | `src/main/ipc/repos/todo-handlers.ts:85-309` | 规范化输入，保存/删除/完成，向 mainWindow 通知，提醒重算。 |
| 存储和迁移 | `src/main/persistence/loading-store/todo-persistence.ts:49-230`、`src/main/persistence/loading-store/todo-normalization.ts:62-94` | 分 scope 持久化，默认列表，旧数据标准化，repo 清理。 |
| 启动/提醒/通知 | `src/main/startup/main-process-ready-runtime.ts:157-166`、`src/main/persistence/loading-store/todo-reminder-scheduler.ts:66-199` | 启动 hydrate、单 timer、resume 重排、通知派发、退出释放。 |

## 3. 需求覆盖映射

| 需求 | 现有实现 | 状态 |
| --- | --- | --- |
| 任务/列表全局与项目隔离 | `repoId=''` 处理全局，其余按 repo bucket 存储 | 已实现，待运行验证。 |
| 旧数据兼容 | `normalizeTodoState` 增补 Tasks、listId、important、steps、note、done | 已实现，存在单测。 |
| 完成/恢复 | `src/main/persistence/loading-store/todo-persistence.ts:80-100,127-147` 设置 `completedAt`、`updatedAt`，UI 过滤完成项 | 已实现，待运行验证。 |
| 单条任务删除确认 | `src/renderer/src/components/right-sidebar/TodoItemRow.tsx:45-51` 的 3 秒二次点击确认 | 未确认或超时不会调用删除；待 UI 验证。 |
| 一级步骤独立状态 | `src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:122-139,253-300` | 步骤独立完成/恢复且完成后仍显示；待 UI 验证。 |
| 智能视图 | 当前 scope 过滤；My Day 汇总 global + 当前 repo | 已实现的行为，与宽泛“所有范围”需确认。 |
| 提醒 | scheduler 查找最近资格任务，投递后写 `reminderDeliveredAt` | 已实现，待重设行为验证。 |
| 删除项目 | `deleteRepoScopedState` 删除 todos/list buckets | 已实现，存在 renderer pruning 单测。 |

## 4. 已确认实现差异/缺口

1. **列表删除**：`removeTodoList` / `removeGlobalTodoList` 将列表内任务的 `listId` 改为 `default`，不是删除任务：`src/main/persistence/loading-store/todo-persistence.ts:173-185,206-217`。与原需求冲突。
2. **Tab/导航状态**：`activeNav` 为 `TodosPanel` component state，初始化为 All：`src/renderer/src/components/right-sidebar/TodosPanel.tsx:87-90`；面板卸载后不会保留。`todoScope` 虽出现在 persisted type，实际只由 renderer setter 内存更新：`src/renderer/src/store/slices/todos/todos-invalidation-actions.ts:15-17`。
3. **跨窗口刷新**：bridge 暴露四类订阅，但 renderer 未见使用；handler 的 `notify` 仅面向注入的 `mainWindow`：`src/main/ipc/repos/todo-handlers.ts:66-70`。现有“多窗口安全”无法据此认定。
4. **删除列表刷新**：store action 删除列表后调用 `fetchTodos()`，该方法在 bucket 已加载时返回，故不会保证重新读取主进程迁移后的任务：`src/renderer/src/store/slices/todos/todos-repo-list-actions.ts:57-80`、`src/renderer/src/store/slices/todos/todos-repo-actions.ts:10-14`。
5. **提醒修改**：save 使用 `reminderDeliveredAt: existing?.reminderDeliveredAt`：`src/main/ipc/repos/todo-handlers.ts:137-141,239-243`；改变 reminder 后可能仍视为已投递。
6. **通知边界**：Todo notification source 已加入既有桌面与可选移动通知链路：`src/main/notifications/notification-delivery-service.ts:79-103`；不是单纯独立原生通知实现。

## 5. 安全与平台边界

- Todo 仅使用客户端 Store；不因 SSH repoPath 触发本地/远端替代执行。SSH 的执行宿主边界仍适用，见 `docs/reference/ssh-execution-boundary.md:5-14`。
- folder workspace 与 Git worktree 同样通过当前 repo 选择使用项目 bucket；没有要求 Git 命令或远端文件访问。
- 平台支持目标为 macOS/Linux/Windows。日期显示采用本地日期，提醒转为 epoch；没有本轮三平台验证。
- 不记录/输出任务标题或备注到新增 telemetry 的证据；通知正文会使用任务标题，属于用户可见通知内容。

## 6. 历史实现记录

原实现说明确认：列表、迁移、项目删除、扩展 IPC/preload/store、智能视图、步骤、提醒 scheduler、通知 source/设置、启动 hydrate、退出 dispose 已添加；My Day 采用全局+当前项目汇总且展示来源。以上均与当前代码静态核实基本一致，但不等于本轮测试通过。

## 7. 实施前后续交接（历史）

在未决 D1-D4 得到产品/设计决定前，不应为了文档补齐而修改代码。若后续授权开发，应优先处理列表删除语义、状态保留、多窗口失效、提醒重设与删除后刷新，并针对 SSH/folder/三桌面平台补充验证。

## 8. 实施完成记录（2026-09-20）

第 1–7 节保留实施前静态盘点和历史交接；以下为已落地事实。

| 范围 | 已实现结果 |
| --- | --- |
| 状态与刷新 | Todo scope/navigation 按 bucket 保留；应用生命周期统一订阅四事件。每个 bucket 有 generation、后台行保留、受保护 rollback 和 prune tombstone，旧请求不能覆盖新状态。 |
| 广播范围 | `createMainWindow` 注册可投递 renderer，`todo-event-renderers` 维护有效 window id；只向工厂创建的 Orca main renderer 广播，不扩散到 dashboard 或其他 trusted UI。 |
| 列表与数据校验 | 删除列表迁移同 scope `Tasks` 并强制刷新；保存拒绝失效/跨 scope list id；日期形状和 finite reminder 校验；nullable 字段 clear 与 undefined 兼容均已实现。 |
| 提醒与通知 | reminder 改值清 delivered，完成清 `reminderAt`/delivered；scheduler 到期重查、忽略无效值并钳制长 timeout。Todo 仅本机通知，不 mobile fanout，且绕过 workspace cooldown。 |
| My Day 与清理 | 行级 CRUD/edit 按 Todo `repoId` 路由；全局/项目按需新鲜加载，本地日期变化重派生。启动清理覆盖单 todo/list 孤儿 bucket，paired-host 不清理。 |

实现已由目标单元测试和后台 E2E 验证；真实双 Todo 窗口 E2E、SSH/folder E2E、非当前 macOS 平台、完整字段重启矩阵、性能与真实通知权限仍未验证。