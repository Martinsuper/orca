# Todo 功能实现说明

> 需求名称：Todo功能
> 日期：2026-09-10
> 状态：已完成
> 关联：.sdlc/02-design/00-Todo功能.md ｜ .sdlc/03-review/00-Todo功能.md

## 已实现

- Todo 列表、旧数据默认列表迁移、项目删除清理、扩展字段和 IPC/preload/store 契约。
- 全局/项目列表、智能视图、跨范围「我的一天」、任务步骤、重要/日期元数据、完成归档与恢复 UI。
- Todo 变更失效刷新、针对数据迁移、store 和导航/视图筛选的测试。
- 主进程提醒调度器（`TodoReminderScheduler`）：单 timer 持最近提醒、启动时从持久化数据恢复、Todo 变更后重算、完成/删除时取消、触发后写 `reminderDeliveredAt` 防重复；订阅 `powerMonitor` 的 `resume`/`suspend` 处理睡眠恢复与时钟变化。
- 系统原生通知接入：`NotificationEventSource` 新增 `'todo-reminder'`，`NotificationSettings` 新增 `todoReminder` 开关，通知选项构建器、分发门控和移动端分发均支持新 source。
- 调度器生命周期：在 `initializeReadyRuntimeServices` 中创建并 hydrate，在 `before-quit` 中 dispose。

## 设计外决策

「我的一天」汇总全局与当前项目当天任务；项目任务在界面中标示来源。

## 遗留

- 完整代码质量门禁被两条既有 `src/renderer/src/components/native-chat/NativeChatTaskList.tsx` 的 React Doctor 发现阻断；本次新增文件的 native/type-aware 检查均通过。
