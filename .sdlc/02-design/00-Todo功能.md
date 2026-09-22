# Todo 功能设计说明

> 需求名称：Todo功能
> 需求编号：00
> 日期：2026-09-20
> 状态：已实现；目标测试通过，完整发布验收未完成
> 关联：[PRD](../01-prd/00-Todo功能.md) ｜ [评审](../03-review/00-Todo功能.md) ｜ [实现](../04-code/00-Todo功能.md) ｜ [测试](../05-test/00-Todo功能.md) ｜ [发布](../06-deploy/00-Todo功能.md)
> 项目画像：Electron + React + TypeScript 本地桌面应用

## 1. 设计范围与历史性质

第 2–10 节保留实施前的代码盘点、方案与评审输入；不再描述当前实现状态。没有企业中间件、SQL、服务端 API 或 JVM 章节。原设计日期为 2026-09-10、状态“待评审”；其历史方案和取舍保留。当前实现事实以第 11 节为准。

## 2. 组件与数据流

`RightSidebarPanelContent` → 懒加载 `TodosPanel` → `TodoNavigation` / `TodoAddInput` / `TodoItemRow` → `TodoEditDialog` → Zustand Todo slice → preload `window.api.todos` → IPC handlers → `Store` / `TodoPersistence` → profile 持久化。

提醒流：`initializeReadyRuntimeServices` → `TodoReminderScheduler.hydrate()` → 最近提醒 timer → 通知 dispatcher → 原生通知/既有通知分发。

| 层 | 文件 | 当前职责 |
| --- | --- | --- |
| 右侧栏 | `src/renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx:12-33` | 懒加载并仅在 `effectiveTab==='todos'` 时挂载面板。 |
| Todo UI | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:48-380` | scope、加载、导航、智能视图、CRUD 动作路由。 |
| 编辑 UI | `src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:67-335` | 标题、备注、列表、重要、日期、提醒、我的一天、一级步骤。 |
| Renderer state | `src/renderer/src/store/slices/todos/create-todos-slice.ts:9-28` | 项目/全局 bucket、加载状态、保存、乐观删除/完成、失效 API。 |
| 预加载 | `src/preload/api/todo-bridge.ts:18-72` | 强类型 IPC bridge 与变更事件订阅 API。 |
| IPC | `src/main/ipc/repos/todo-handlers.ts:85-309` | 输入规范化、项目存在校验、持久化调用、scheduler 重算、窗口通知。 |
| 持久化 | `src/main/persistence/loading-store/todo-persistence.ts:58-230` | scope 分桶、排序、默认列表、任务/列表 CRUD、repo 数据清理。 |
| 迁移 | `src/main/persistence/loading-store/todo-normalization.ts:18-94` | 旧数据补字段与默认列表。 |
| 提醒 | `src/main/persistence/loading-store/todo-reminder-scheduler.ts:31-199` | 收集全局+已注册 repo 任务、单 timer、恢复重排、去重标记。 |

## 3. 数据模型与持久化

| 对象 | 字段/规则 | 代码证据 |
| --- | --- | --- |
| `Todo` | `id`、`repoId`、标题、备注、完成/完成时间、创建/更新时间、可选列表、重要、截止日期、提醒/投递时间、我的一天日期、步骤 | `src/shared/types.ts:26-48` |
| `TodoList` | `id`、`repoId`、标题、创建/更新时间 | `src/shared/types.ts:51-58` |
| 项目数据 | `todosByRepo[repoId]` 与 `todoListsByRepo[repoId]` | `src/shared/persisted-state-types.ts:80-87` |
| 全局数据 | `globalTodos` 与 `globalTodoLists`，任务 `repoId=''` | 同上 |
| 默认列表 | id=`default`、标题 `Tasks`；每个 scope 自动确保存在 | `src/main/persistence/loading-store/todo-normalization.ts:4-15` |

加载时，`normalizeTodoState` 为所有已有项目 bucket 和全局 scope 补默认列表与旧字段；`src/main/persistence/loading-store/loaded-state-parsing.ts:271-273` 将其标记为待保存。排序层按创建时间返回任务；智能视图再按逾期、截止日期和更新时间排序，见 `src/renderer/src/components/right-sidebar/todo-view-filters.ts:18-49`。任务删除在 `src/renderer/src/components/right-sidebar/TodoItemRow.tsx:45-51` 采用 3 秒二次点击确认，未二次确认即保留；一级步骤在 `src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:122-139` 独立切换/移除，完成步骤仍显示且可恢复。

## 4. 范围与视图规则

| 场景 | 实际规则 | 代码证据 |
| --- | --- | --- |
| Project | 仅当前 active repo 的 bucket；无 active repo 时不可快速新增 | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:83-85,264-265` |
| Global | 使用独立 global IPC 与缓存 | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:119-126` |
| My Day | 聚合 global + 当前 repo 中 `myDayDate===本地今天`、未完成任务 | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:134-145`、`src/renderer/src/store/slices/todos/todos-slice-contract.ts:67-89` |
| 重要/计划内/全部/已完成 | 只对当前 scope 的任务过滤 | `src/renderer/src/components/right-sidebar/TodosPanel.tsx:152-167` |
| 列表 | 只显示未完成且 `listId` 相同的当前 scope 任务 | `src/renderer/src/components/right-sidebar/todo-view-filters.ts:52-54` |
| 逾期 | 未完成、截止日期早于本地今天 | `src/renderer/src/components/right-sidebar/TodoItemRow.tsx:18-27` |

当前 scope 只存 renderer Zustand 内存；虽有持久化类型字段 `todoScope`，并无读取或写入接线。Todo Tab 切换导致面板卸载，`activeNav` 初始化为 All，因此不能宣称状态可跨 Tab 保留。

## 5. IPC 契约与异常处理

| Channel | 输入 | 行为/异常 |
| --- | --- | --- |
| `todos:list` / `listGlobal` | `repoId` 或无参数 | 获取项目/全局任务。 |
| `todos:save` / `saveGlobal` | 标题、可选 id/list/备注/元数据/步骤 | 标题 trim 且不能为空，标题≤500、备注≤2000；项目 repo 必须存在。 |
| `todos:toggle` / `toggleGlobal` | todo id、done | 找不到任务抛错；持久层更新 `completedAt` / `updatedAt`。 |
| `todos:remove` / `removeGlobal` | todo id | 移除后重算提醒。 |
| `todos:listLists` / `listGlobalLists` | repoId 或无参数 | 获取并确保默认列表。 |
| `todos:saveList` / `saveGlobalList` | 标题、可选 id | 标题不能为空、≤500。 |
| `todos:removeList` / `removeGlobalList` | list id、`confirmed=true` | 未确认抛错；默认列表抛错。实际将任务迁移至默认列表，而非删除。 |

截止日期仅验证 `YYYY-MM-DD` 形状，提醒值未做 finite/future 校验。保存更新会保留既有 `reminderDeliveredAt`，是待复审风险。

## 6. 提醒与通知

- scheduler 在主进程启动时创建并 hydrate：`src/main/startup/main-process-ready-runtime.ts:157-166`；退出时 dispose：`src/main/startup/main-process-quit.ts:81-82`。
- 仅调度最近的符合资格任务；完成、已投递、无提醒任务不参与；休眠恢复调用 `reconcile()`：`src/main/persistence/loading-store/todo-reminder-scheduler.ts:41-50,85-97,107-123`。
- 触发前重新查询任务，避免删除/完成后误提醒；通知异常仍写入 delivered 标记：`src/main/persistence/loading-store/todo-reminder-scheduler.ts:125-185`。
- 通知由总开关和 `todoReminder` 开关共同门控，窗口不可见时请求 tray attention：`src/main/notifications/notification-delivery-service.ts:56-76`；标题为 `Task reminder`：`src/main/ipc/notification-options.ts:37-43`。
- 通知服务可接入移动端分发；这与“仅本机系统通知”的产品措辞需产品确认。

## 7. folder、SSH 与跨平台边界

Todo 不调用 Git、文件系统、PTY 或远端 provider；任务数据由客户端本地 Store 持有。对 SSH workspace，执行主机仍拥有远端执行/进程事实，客户端不能因 SSH 断连将任务关联的执行状态写为已退出；遵循 `docs/reference/ssh-execution-boundary.md:5-14`。folder workspace 使用同样的本地 scope 模型，不依赖其是否为 Git worktree。

macOS/Linux/Windows 均使用 Electron 与原生日期输入；`datetime-local` 在 renderer 转为 epoch ms，`src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:40-59`。测试原生通知或 Electron UI 必须后台运行，使用 `ORCA_BACKGROUND_LAUNCH=1` 与隔离 CI/CDP，不允许可见窗口抢焦点。

## 8. 已知差异、风险与取舍

| ID | 类型 | 事实 | 影响/待处理 |
| --- | --- | --- | --- |
| RISK-01 | 需求差异 | 原目标为删除列表及任务；实现重分配到默认列表 | 等待 D1 产品决策后再定验收。 |
| RISK-02 | 需求差异 | Tab 切换不保留 active navigation；scope 不持久化 | 不能满足原状态保留表述。 |
| RISK-03 | 一致性 | bridge 有变更订阅但 renderer 未消费；IPC 通知单一窗口 | 多窗口缓存可陈旧。 |
| RISK-04 | 提醒 | 修改提醒可能保留已投递标记 | 可能错过重新设置后的提醒。 |
| RISK-05 | 删除刷新 | 删除列表 action 后调用已加载 bucket 的 fetch，可能不刷新迁移后的任务 | UI 与持久层可能短暂不一致。 |
| TRADE-01 | 取舍 | 只保留一个最近提醒 timer | 低资源；依赖每次 mutation/recovery 重排。 |
| TRADE-02 | 取舍 | My Day 仅全局+当前项目，不扫描全部项目 | 控制加载范围；不是全工作区汇总。 |

## 9. 需求回链

| PRD | 设计承接 | 当前结论 |
| --- | --- | --- |
| R1/R2 | 第 2、4、7 节 | 部分：Tab 状态保留差异。 |
| R3 | 第 3、5 节 | 部分：删除语义差异。 |
| R4/R5 | 第 3、4、5 节 | 实现存在，待执行验证。 |
| R6 | 第 6 节 | 部分：提醒重设和通知边界待确认。 |
| R7 | 第 3、7 节 | 实现存在，重启/多窗口仍待补验。 |

## 10. 已确认修复方案（待实施）

本节基于当前实现复审后新增，保留第 1–9 节的历史事实。目标是修正现有差异，不将“设计通过”解释为当前实现、测试或发布通过。

### 10.1 Renderer 状态与导航契约

- 将 `todoScope` 与 `activeNav` 提升到 Todo Zustand slice，并按 `scopeKey = global | project:<repoId>` 保存导航；Right Sidebar 卸载/重新挂载只读取状态，不重置为 All。
- scope 切换保留该 scope 上次有效导航；Project 当前 repo 变化时仅使用新 `project:<repoId>` 的状态。若导航的列表不在已加载列表中，或刚收到了该 scope 列表失效，则原子回退至 All，避免跨 repo 复用 list id。
- My Day 保持“全局 + 当前 repo”聚合，但行级 action 传递完整 `Todo`；toggle/remove/edit 均以 `todo.repoId` 判定项目/全局 IPC。编辑弹窗从该 repo 的列表 bucket 读取候选列表并校验 `listId`，不再从当前面板 scope 推断归属。

### 10.2 广播、订阅与竞态契约

- 维持 preload 已定义的四类事件：`todos:changed`、`todos:listsChanged`、`todos:globalChanged`、`todos:globalListsChanged`。主进程抽出广播器，遍历所有未销毁且可用的 Orca renderer `webContents`；项目事件带 `{repoId}`，全局事件无 repo payload。
- 每类 mutation 只广播权威失效：项目任务 CRUD/toggle → 项目任务；项目列表 CRUD → 项目列表；删除项目列表或全局列表因迁移任务，必须额外广播对应任务事件。scheduler 的 `reconcile()` 仍在持久化成功后执行。
- `TodosPanel` 挂载即订阅四类事件，卸载逐一调用 unsubscribe。事件只失效受影响 bucket：当前 repo 命中的项目事件刷新该 repo 的任务/列表，global 事件刷新 global bucket；My Day 因依赖两 scope，在任一相关任务失效后重新计算。
- slice 对每个 bucket 保存 generation/request token：invalidate 先递增 generation，再 fetch；请求返回仅在 token 仍为当前 generation 时提交，避免卸载、repo 切换或连续 mutation 的旧响应回写。删除列表 action await mutation 后显式 invalidate 任务与列表，不能用“loaded”短路。

### 10.3 保存、提醒和通知契约

- bridge、共享保存参数与 handler 将 `dueDate`、`reminderAt`、`myDayDate` 改为可选且可为 `null`：`undefined` 沿用 existing，`null` 删除字段，值则规范化保存。日期继续要求完整 `YYYY-MM-DD`；`reminderAt` 必须 `Number.isFinite`，无效值拒绝。
- 保存时比较规范化后的新旧 `reminderAt`；变化（含设定、替换、清空）即清除 `reminderDeliveredAt`。完成任务时持久层清空 `reminderAt` 与 `reminderDeliveredAt`；恢复不自动重建提醒。scheduler 仅调度未完成且拥有有效 reminder、未投递的 Todo。
- 通知 delivery policy 对 `source === 'todo-reminder'` 在移动端 fanout 前直接跳过，仅保留本机 tray/native 通知与既有 `todoReminder` 开关；其他通知来源维持原策略。

### 10.4 列表删除、隔离与启动清理

- `removeTodoList` / `removeGlobalTodoList` 保持确认和默认列表保护；将任务迁移至同 scope `Tasks` 并持久化。项目版不得把全局数据写入 `todoListsByRepo['']`；应复用 scope 写入分支，保证 global 列表只写 `globalTodoLists`。
- repo 生命周期删除和启动 `sweepDeregisteredRepoResidue()` 均以 `todosByRepo` 与 `todoListsByRepo` 的 key 并集识别孤儿；已配对 runtime host 的 repo 延续当前豁免，避免本地启动时误删远端数据。

### 10.5 实施验证设计

| 层级 | 针对性验证 |
| --- | --- |
| 单元 | persistence 的 global/project 列表迁移与清理；handler 的 null/undefined、finite reminder、delivered 重置、完成清除与全窗口四事件广播；slice generation 防旧响应；My Day 按 `todo.repoId` 路由。 |
| Renderer | Todo Tab 往返保留 scope/nav、repo/list 无效回退、四订阅注册/清理、列表删除后的任务即时刷新、跨 scope My Day 编辑/删除/完成。 |
| 后台 E2E | `ORCA_BACKGROUND_LAUNCH=1` 下以 CDP 验证重启恢复、两个 renderer 的 mutation 刷新和本机 Todo 提醒不产生移动端 dispatch；不显示或聚焦窗口。 |

### 10.6 风险、取舍与回滚

- 广播采用失效再取数而非跨窗口直接写入结果，牺牲一次读取换取主进程持久化为唯一事实源；generation 防止刷新风暴中的陈旧回写。
- scope 状态仅存 renderer store，不写 profile；应用完全重启后回到默认导航仍可接受，R8 仅承诺 Tab 生命周期保留。若产品后续要求重启恢复导航，需单列持久化需求。
- 变更可整体回滚为原 handler/slice；数据模型对 `null` 只在 IPC 边界解释，不新增不可逆持久化字段。现有任务和列表不迁移结构。

## 11. 实施后设计事实与偏差（2026-09-20）

第 2–10 节中的“待实施/当前缺口”均为实施前快照；本节是当前实现契约。

- 四类事件订阅位于应用生命周期，而非 `TodosPanel` mount：隐藏/未挂载的 Todo 面板也不会错过 mutation；store 接收事件后按项目任务、项目列表、全局任务、全局列表 bucket 失效。
- 广播目标不是所有可信 UI 或 dashboard。`createMainWindow` 显式注册应用 main window，`todo-event-renderers` 以 window id 集合只向该工厂创建且仍有效的 renderer 广播；默认产品只有一个 main window，同时支持工厂创建的每一个窗口。
- 每个 store bucket 维护 generation；后台行保留，mutation rollback 受 generation 保护，bucket prune 后保留 tombstone generation，避免旧 fetch 或回滚复活被清理的状态。
- My Day 按 Todo `repoId` 选取 mutation/list bucket，必要时刷新全局和当前 repo；本地日期变化后重新派生视图。列表保存拒绝过期 id 或跨 scope list id。
- scheduler 对 timer 到期再次读取当前 Todo，校验 reminder 有效性并钳制超长 timeout；Todo 通知不参加 workspace cooldown，以避免相邻 Todo 任务被通用 cooldown 合并丢失，同时继续由 scheduler delivered 标记去重。

已验证单元级 renderer 注册/失效广播；未执行真实两个完整 Todo 窗口的 E2E，因此不把“所有窗口”误记为端到端已验证。
