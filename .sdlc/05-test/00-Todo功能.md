# 测试计划：Todo 功能

> 需求名称：Todo功能
> 日期：2026-09-09
> 状态：全通过
> 关联：.sdlc/02-design/00-Todo功能.md ｜ .sdlc/03-review/00-Todo功能.md

---

## 一、测试范围

基于设计文档的验收标准和代码变更范围，测试覆盖以下层次：

| 层次 | 覆盖内容 | 测试文件 |
| --- | --- | --- |
| Zustand Store Slice | 项目级 Todo 的 fetch/save/remove/toggle（正常+异常+乐观更新+回滚）；全局 Todo 的对应操作；scope 切换 | `src/renderer/src/store/slices/todos.test.ts` |
| Repo 清理 | `omitTodosForRepos` 在 repo 删除时正确清理 `todosByRepo` 及其 loading/status/error maps | `src/renderer/src/store/slices/todos-repo-pruning.test.ts` |

---

## 二、用例矩阵

### 2.1 项目级 Todo（todos.test.ts）

| # | 场景 | 输入 | 预期输出 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | fetch 加载到对应 repo bucket | `fetchTodos('repo-1')`，list 返回 [todo] | `todosByRepo['repo-1']` = [todo]，status='loaded' | 单元 | ✅ |
| 2 | 已加载时跳过重复 fetch | 连续调两次 `fetchTodos('repo-1')` | list 只被调用 1 次 | 单元 | ✅ |
| 3 | 正在加载时跳过重复 fetch | 并发调两次 `fetchTodos('repo-1')` | list 只被调用 1 次 | 单元 | ✅ |
| 4 | fetch 失败记录错误 | list reject('disk failed') | status='error', error='disk failed', byRepo=undefined | 单元 | ✅ |
| 5 | save 新增追加到列表 | 已有 1 条，save 新 todo | 列表长度=2，返回 saved | 单元 | ✅ |
| 6 | remove 乐观删除+失败回滚 | remove reject | 列表恢复原长度 | 单元 | ✅ |
| 7 | toggle 乐观更新+服务端校正 | toggle 返回 updatedAt=5 | done=true, updatedAt=5 | 单元 | ✅ |
| 8 | toggle 失败回滚 | toggle reject | done 恢复原值 | 单元 | ✅ |

### 2.2 全局 Todo（todos.test.ts）

| # | 场景 | 输入 | 预期输出 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 9 | fetch 全局 todos | `fetchGlobalTodos()`，listGlobal 返回 [todo] | `globalTodos` = [todo]，status='loaded' | 单元 | ✅ |
| 10 | save 全局 todo | `saveGlobalTodo({title})` | `globalTodos` 长度=1 | 单元 | ✅ |
| 11 | remove 全局 todo + 回滚 | removeGlobal reject | `globalTodos` 恢复原长度 | 单元 | ✅ |
| 12 | toggle 全局 todo | toggleGlobal 返回 done=true | `globalTodos[0].done`=true | 单元 | ✅ |

### 2.3 Scope 切换（todos.test.ts）

| # | 场景 | 输入 | 预期输出 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 13 | 默认 scope 为 project | 初始化 | `todoScope`='project' | 单元 | ✅ |
| 14 | 切换 scope | `setTodoScope('global')` → `setTodoScope('project')` | `todoScope` 正确切换 | 单元 | ✅ |

### 2.4 Repo 清理（todos-repo-pruning.test.ts）

| # | 场景 | 输入 | 预期输出 | 类型 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 15 | 无删除时返回空 | removed=[] | `{}` | 单元 | ✅ |
| 16 | 删除 repo 时清理 todosByRepo | removed=['repo-1'] | `todosByRepo` 只剩 repo-2 | 单元 | ✅ |
| 17 | 删除 repo 时清理 loading/status/error | removed=['repo-1'] | 对应 maps 只剩 repo-2 | 单元 | ✅ |
| 18 | 不 mutate 原始 state | removed=['repo-1'] | 原 state 的 `todosByRepo` 仍有 repo-1 | 单元 | ✅ |

---

## 三、实际运行结果

```
Test Files  2 passed (2)
     Tests  18 passed (18)
  Duration  258ms
```

- **通过率**：18/18 = 100%
- **失败数**：0
- **测试文件**：
  - `src/renderer/src/store/slices/todos.test.ts` — 14 个用例
  - `src/renderer/src/store/slices/todos-repo-pruning.test.ts` — 4 个用例

---

## 四、未覆盖项说明

以下层次的测试在 MVP 阶段未补齐，原因和后续计划：

| 层次 | 未覆盖原因 | 后续计划 |
| --- | --- | --- |
| IPC Handler（todo-handlers.ts） | handler 是纯转发+校验逻辑，核心数据操作由 `TodoPersistence` 和 store slice 覆盖；handler 层测试需要 mock `Store` 和 `BrowserWindow`，成本高收益低 | 后续可加集成测试，mock Store 验证 IPC 转发和 notify 调用 |
| TodoPersistence 类 | 与 `ProjectLinkPersistence` 结构对称，现有 Project Links 也未单独测 Persistence 类 | 后续可补 |
| UI 组件（TodosPanel/TodoItemRow 等） | 需要 Electron 渲染环境 + Playwright CDP，按 AGENTS.md 约定用 `$electron` skill 验证 | 后续用 Playwright CDP 做渲染验证 |
| 集成/E2E | 需要完整 Electron 启动 | 后续在 CI 环境补 |
