# Todo 功能测试计划与已有结果

> 需求名称：Todo功能
> 需求编号：00
> 日期：2026-09-20
> 状态：目标测试与 Todo E2E 通过；完整验收未完成
> 关联：[PRD](../01-prd/00-Todo功能.md) ｜ [设计](../02-design/00-Todo功能.md) ｜ [评审](../03-review/00-Todo功能.md) ｜ [实现](../04-code/00-Todo功能.md) ｜ [发布](../06-deploy/00-Todo功能.md)

## 1. 测试口径与历史计划

第 2–7 节区分历史已记录结果与实施前待执行计划；当前真实结果以第 8 节为准。历史 18/18 或已有测试文件不能替代第 8 节记录的本次真实执行结果。

测试应覆盖 Electron + React + TypeScript 客户端，不涉及 SQL、服务端、JVM 或企业中间件。所有自动化 Electron/原生通知检查必须后台运行：使用 `ORCA_BACKGROUND_LAUNCH=1` 或既有 headless E2E harness，在隔离 CI/显示环境以 CDP/DOM 验证；禁止建议在用户桌面打开可见窗口、抢焦点或使用 `show()`/`bringToFront()`。

## 2. 当前测试资产

| 层级 | 文件 | 已知覆盖 | 当前执行状态 |
| --- | --- | --- | --- |
| Renderer store | `src/renderer/src/store/slices/todos.test.ts` | 项目/全局 CRUD、列表、My Day 聚合、invalidation、scope | 未在本轮运行 |
| Renderer prune | `src/renderer/src/store/slices/todos-repo-pruning.test.ts` | repo 删除时清理任务/列表/加载状态 | 未在本轮运行 |
| 迁移 | `src/main/persistence/loading-store/todo-normalization.test.ts` | 默认列表、旧字段补齐、已标准化数据 | 未在本轮运行 |
| 提醒 | `src/main/persistence/loading-store/todo-reminder-scheduler.test.ts` | 最近提醒、完成/删除抑制、去重、重排、repo/global | 未在本轮运行 |
| 通知 | `src/main/ipc/notifications-todo-reminder.test.ts` | 开关允许/禁用、通知内容、tray attention | 未在本轮运行 |
| 导航 UI | `src/renderer/src/components/right-sidebar/TodoNavigation.test.tsx` | 智能视图、列表、创建入口 | 未在本轮运行 |
| 过滤器 | `src/renderer/src/components/right-sidebar/todo-view-filters.test.ts` | 逾期/智能视图排序过滤 | 未在本轮运行 |
| E2E | `tests/e2e/todos.spec.ts` | 项目/全局基础 CRUD | 未在本轮运行，需先审查选择器与当前文案。 |

## 3. 历史结果（保留，不升级结论）

原测试文档日期为 **2026-09-09**，状态“全通过”，记录：

```text
Test Files  2 passed (2)
Tests       18 passed (18)
Duration    258ms
```

其明确范围是 `src/renderer/src/store/slices/todos.test.ts` 的 14 条和 `src/renderer/src/store/slices/todos-repo-pruning.test.ts` 的 4 条。历史记录没有覆盖主进程 IPC、持久化迁移、scheduler、通知、完整 UI、重启、E2E、三平台、folder、SSH 或多窗口，不能作为全部验收、发布或本轮通过证据。

### 2026-09-20 文档整理校验

| 命令 | 结果 | 结论 |
| --- | --- | --- |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed` | 通过；输出为无变更 JS/TS | 仅说明该检查未发现待检查的 JS/TS 变更，不是 Todo 功能测试。 |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm tc` | 报 `src/shared/types.ts:76` 导出 `BrowserSessionProfileCreateOptions` 不存在，并在 120 秒后超时 | 无完整通过结果；与 Todo 功能正确性无直接等价关系。 |

上述为统一验证提供的既有结果；本次未自行执行任何命令。静态校验不能替代单元、集成、E2E、重启、通知或跨平台功能验证。

## 4. 待执行用例矩阵

| ID | 前置条件 | 步骤 | 预期 | 证据来源/目标文件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T-01 | 有 active repo | 切 Project，创建、编辑、完成、恢复、删除任务 | 操作只影响项目 bucket；完成任务进入 Completed | store + E2E | ☐ 未执行 |
| T-02 | 无 active repo | 切 Global，执行 CRUD | Global 可用，Project 显示无项目状态 | UI/E2E | ☐ 未执行 |
| T-03 | global 与当前 repo 各有当天/非当天/完成任务 | 打开 My Day | 仅汇总 global+当前 repo 的当天未完成任务并标来源 | `getMyDayTodos` + UI | ☐ 未执行 |
| T-04 | 当前 scope 有重要、计划内、逾期、完成任务 | 依次切智能视图 | 按当前 scope 过滤；逾期样式明显 | filters + TodoItemRow/UI | ☐ 未执行 |
| T-05 | 旧 profile Todo 缺新字段 | 加载 Store | 创建 Tasks、补 `listId/important/steps/note/done` 并标记落盘 | normalization test + 重启集成 | ☐ 未执行 |
| T-06 | 自定义列表有任务 | 确认删除列表 | 根据 D1 产品决定验证永久删除或迁移 default；当前实现事实为迁移 | persistence/IPC/UI | ☐ 被 D1 阻断 |
| T-07 | 默认列表 | 尝试删除 | 被拒绝，不损坏数据 | IPC/persistence | ☐ 未执行 |
| T-08 | 保存标题空白、超长标题/备注、无效日期 | 触发保存 | 空标题拒绝；长度按 handler 截断；日期形状校验 | handler unit/integration | ☐ 未执行 |
| T-08a | 列表中存在单条任务 | 第一次点击删除，再取消、等待超过 3 秒或不进行第二次确认 | 任务保留，删除接口不被调用 | `src/renderer/src/components/right-sidebar/TodoItemRow.tsx:45-51` 的 UI/E2E | ☐ 未执行 |
| T-08b | 列表中存在单条任务 | 在 3 秒确认窗口内第二次点击删除 | 任务从当前列表和相关智能视图移除 | UI/E2E + store action | ☐ 未执行 |
| T-08c | 任务含未完成及已完成一级步骤 | 完成一个步骤、恢复该步骤、重新打开编辑态 | 步骤独立于任务完成状态；完成步骤保持可见且可恢复 | `src/renderer/src/components/right-sidebar/TodoEditDialog.tsx:122-139,253-300` 的 UI test | ☐ 未执行 |
| T-09 | 设置 future reminder | 启动/重排/到期 | 只调度最近任务，触发一次，写 delivered 标记 | scheduler test | ☐ 未执行 |
| T-10 | 提醒任务完成/删除/已投递 | 到期前改变状态 | 不投递；timer 重排 | scheduler test | ☐ 未执行 |
| T-11 | 已投递提醒后改 reminder 时间 | 保存为新 reminder 后到期 | 行为须以 D4 决策为准；当前可能被 delivered 标记抑制 | handler + scheduler | ☐ 被 D4 阻断 |
| T-12 | 通知授权/拒绝、窗口隐藏 | 到达提醒 | 授权时通知一次；拒绝不影响数据；隐藏窗口仅验证 tray/通知，无前台抢焦点 | notification test + 隔离 E2E | ☐ 未执行 |
| T-13 | 删除项目/启动孤儿清理 | 移除 repo 或模拟不再注册 | 删除持久化任务和列表、renderer bucket | lifecycle/pruning | ☐ 未执行 |
| T-14 | 两个 renderer window | 在一窗修改任务/列表 | 依据 D3：要么两窗失效刷新，要么调整需求；不得静默声称一致 | multi-window E2E | ☐ 被 D3 阻断 |
| T-15 | 切出 Todo 再切回 | 选择列表/智能视图后切 Tab | 依据 D2 验证保留或回到 All 的产品决定 | UI/E2E | ☐ 被 D2 阻断 |
| T-16 | folder workspace | 创建项目任务、切 global | 不需要 Git；隔离与无项目状态符合 PRD | background E2E | ☐ 未执行 |
| T-17 | SSH workspace 且断连模拟 | 访问 Todo / 断连 | Todo 不替代远端执行，不将执行状态判为 exited；本地数据边界保持 | isolated SSH E2E | ☐ 未执行 |
| T-18 | macOS/Linux/Windows CI | 执行适用套件 | 日期、通知降级、UI 和持久化无平台特有失败 | platform CI | ☐ 未执行 |

## 5. 建议命令（仅供主 agent 后续统一核验）

| 目的 | 命令 | 本轮 |
| --- | --- | --- |
| Todo 相关 Vitest | `pnpm test src/renderer/src/store/slices/todos.test.ts src/renderer/src/store/slices/todos-repo-pruning.test.ts src/main/persistence/loading-store/todo-normalization.test.ts src/main/persistence/loading-store/todo-reminder-scheduler.test.ts src/main/ipc/notifications-todo-reminder.test.ts src/renderer/src/components/right-sidebar/TodoNavigation.test.tsx` | 未执行 |
| 全量类型检查 | `pnpm tc` | 未执行 |
| 变更代码质量 | `pnpm run check:code-quality:changed` | 未执行 |
| Todo E2E | `ORCA_BACKGROUND_LAUNCH=1 pnpm run test:e2e -- tests/e2e/todos.spec.ts` | 未执行 |

E2E 依赖 `tests/e2e/AGENTS.md` 规定的 e2e build 和后台策略；执行前由主 agent 检查当前 `tests/e2e/todos.spec.ts` 的 `Edit Todo` 选择器是否仍与 `TodoEditDialog` 的 `Edit Task` 文案一致。

## 6. 覆盖目标与缺口

| 维度 | 当前证据 | 目标状态 |
| --- | --- | --- |
| 纯状态逻辑 | 有部分历史/现有单测代码 | 重新运行并记录结果。 |
| IPC 与持久化 | handler 未见专用测试 | 补或执行集成证据。 |
| 迁移/重启 | 仅迁移单测 | 增加隔离 profile 重启验证。 |
| 通知 | notification/scheduler 单测存在 | 隔离环境验证授权、拒绝、隐藏窗口、恢复。 |
| UI | 导航少量单测、基础 E2E | 覆盖对话框、任务删除确认/取消、一级步骤独立完成与恢复、删除列表语义、状态保留、错误/空态。 |
| 多窗口 | 无已核实证据 | 先解决/确认 D3，再做 E2E。 |
| 平台/SSH/folder | 无本轮证据 | 在 CI 或隔离环境补验证。 |

## 7. 实施前当前结论（历史）

**测试待补验。** 已有历史 18/18 只反映两个 renderer store 文件当时的结果；当前测试文件存在不等于当前代码已通过。D1、D2、D3、D4 的决策决定后，按本计划执行并以真实命令输出填写结果。

## 8. 最新执行结果（2026-09-20）

第 1–7 节中的“本轮未执行”“被 D1–D4 阻断”和建议命令均为实施前计划/历史记录，本节为当前结果。

| 检查 | 结果 | 覆盖/限制 |
| --- | --- | --- |
| 目标 Vitest | `ORCA_BACKGROUND_LAUNCH=1 pnpm test src/renderer/src/store/slices/todos src/renderer/src/components/right-sidebar/Todo src/renderer/src/components/right-sidebar/todo-view-filters.test.ts src/renderer/src/app-shell/todo-invalidation src/main/ipc/repos/todo src/main/persistence/loading-store/todo src/main/ipc/notifications-todo-reminder.test.ts src/main/notifications/notification-delivery-service.test.ts src/main/persistence-deregistered-repo-residue.test.ts src/main/window/todo-event-renderers src/main/window/createMainWindow`：25 files、253 tests 通过，4.15s。 | 覆盖 store generation/rollback、事件注册/失效、IPC/persistence、scheduler、通知和孤儿清理等目标单元范围。 |
| 变更质量与差异 | `ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed`：0 findings、36 changed JS/TS files；`git diff --check` 通过。 | 不是功能或发布验收。 |
| 类型检查 | `pnpm tc` 未通过：`src/shared/types.ts:76` 的 `BrowserSessionProfileCreateOptions` 未从 `browser-workspace-types` 导出。 | 为基线未改动错误；不得标记 typecheck 通过。 |
| 后台 Todo E2E | `ORCA_BACKGROUND_LAUNCH=1 pnpm exec electron-vite build --mode e2e && ORCA_BACKGROUND_LAUNCH=1 pnpm exec tsc -p config/tsconfig.cli.json --outDir out --composite false --incremental false --noCheck && SKIP_BUILD=1 ORCA_BACKGROUND_LAUNCH=1 ORCA_E2E_HEADLESS=1 ORCA_E2E_HEADFUL=0 ORCA_E2E_FORCE_HEADFUL=0 ORCA_E2E_FOREGROUND=0 pnpm run test:e2e tests/e2e/todos.spec.ts --workers=1`：3 passed，14.5s。 | 覆盖 Tasks 迁移、scope/侧栏 Tab 保留、My Day 跨 scope 完成不复制 global、完成过滤、global 重启持久化。截图：`test-results/todos-Todos-shows-project--86986--completed-tasks-out-of-All-electron-headless/todos-hidden-renderer.png`。 |

`noCheck` 仅用于 E2E 前的独立 transpilation，不构成 typecheck 成功。

### 仍未验证

- 两个真实完整 Todo 窗口的 E2E；当前仅有 renderer 注册和失效广播单测。
- macOS 以外的 Linux/Windows 平台、SSH/folder 实际 E2E、全部字段的重启矩阵、性能和真实原生通知权限。
- 发布候选、签名、profile 备份与发布后观察。