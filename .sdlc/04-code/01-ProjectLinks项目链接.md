# ProjectLinks 项目链接实现说明

> 需求名称：ProjectLinks项目链接
> 需求编号：01
> 日期：2026-09-20
> 状态：既有实现已整理；本阶段未开发、未执行核验
> 关联：[PRD](../01-prd/01-ProjectLinks项目链接.md) ｜ [设计文档](../02-design/01-ProjectLinks项目链接.md) ｜ [评审记录](../03-review/01-ProjectLinks项目链接.md) ｜ [测试计划](../05-test/01-ProjectLinks项目链接.md) ｜ [发布回滚清单](../06-deploy/01-ProjectLinks项目链接.md)

---

## 1. 本文件范围

本文件记录当前工作区中已经存在的 ProjectLinks 实现事实、历史恢复计划和已发现覆盖差异。2026-09-20 的本次工作仅整理文档：没有修改业务代码、没有运行测试/lint/类型检查/构建、没有启动应用，也没有发布。

历史相关提交证据为 `6086fc4d524fff7fedf99803d00cb1418787baf9`，主题 `feat(project-links): add global links and transfer`（2026-08-03）。当前 HEAD 为 `79113ebf7d`。提交或源码存在不等价于当前版本已验证、评审通过或可发布。

## 2. 已存在实现事实

### 2.1 类型、默认 state 与 Store 组合

| 文件 | 事实 | 关键位置 |
| --- | --- | --- |
| `src/shared/types.ts` | 定义 `ProjectLink`：id、repoId、name、url、category、可选 order、创建/更新时间。 | `:6` |
| `src/shared/persisted-state-types.ts` | 定义项目 links/folders map 以及可选 global links/folders。 | `:68` |
| `src/shared/constants.ts` | 新 profile 初始化项目 links/folders 空 map。 | `:143` |
| `src/main/persistence/loading-store/project-link-persistence.ts` | 定义项目/global CRUD、排序、folder CRUD 和 scheduleSave。 | `:15`、`:23` |
| `src/main/persistence/loading-store/store-domain-composition.ts` | 构造、安装并把 ProjectLink domain 放入 Store operation classes。 | `:92`、`:107`、`:128`、`:166` |
| `src/main/persistence/loading-store/store.ts` | Store declaration merge 暴露 `ProjectLinkPersistence` 方法。 | `:25`、`:110` |

### 2.2 main IPC 与输入安全

| 文件 | 事实 | 关键位置 |
| --- | --- | --- |
| `src/main/ipc/repos.ts` | repo handler 注册时调用 `registerProjectLinkHandlers`。 | `:12`、`:83` |
| `src/main/ipc/repos/project-link-handlers.ts` | 注册项目/global links、folders、import/export handler；项目写操作检查 repo。 | `:50`、`:81`、`:127`、`:148`、`:185` |
| `src/main/ipc/project-link-normalization.ts` | 名称/分类/URL 规范化，URL 只允许 HTTP/HTTPS。 | `:9`、`:20`、`:29` |
| `src/main/ipc/project-links-import-merge.ts` | 解析版本化 envelope，链接按规范化 `(url, category)` 合并去重。 | `:22`、`:75` |
| `src/shared/project-links-export.ts` | 定义 `orca-project-links` schema version 1；导出不携带 ID/时间戳。 | `:5`、`:8` |
| `src/main/ipc/shell.ts` | 再次解析 URL，并仅对 HTTP/HTTPS 调用 `shell.openExternal`。 | `:79` |

### 2.3 preload 与 renderer

| 文件 | 事实 | 关键位置 |
| --- | --- | --- |
| `src/preload/api/project-links-todos-api.ts` | 定义 project links 与 folders 的 typed API。 | `:3`、`:91` |
| `src/preload/api/project-links-bridge.ts` | 将 API 转为明确 IPC invoke/on/removeListener。 | `:4`、`:27` |
| `src/preload/index.ts` | 暴露 links、folders 和 shell API 给 renderer。 | `:17`、`:114`、`:157` |
| `src/renderer/src/store/slices/project-links.ts` | 本项目 links/folders 的 load state、乐观 CRUD、重排、全局数据组合。 | `:27`、`:61` |
| `src/renderer/src/store/slices/global-project-links.ts` | global links/folders 的状态和动作。 | 文件存在，具体行为由 slice 组合使用。 |
| `src/renderer/src/store/slices/project-links-transfer.ts` | 导出反馈；导入成功后清缓存并重新 fetch links/folders。 | `:16`、`:47` |
| `src/renderer/src/components/right-sidebar/LinksPanel.tsx` | 面板加载、toolbar、local/global 树、拖拽 guard、dialog 入口。 | `:41`、`:81`、`:168`、`:236` |
| `src/renderer/src/components/right-sidebar/ProjectLinksManagerDialog.tsx` | local/global tab 中的新增、编辑、两步删除确认。 | `:28`、`:91`、`:126` |
| `src/renderer/src/components/right-sidebar/ProjectLinkFolderDialog.tsx` | 文件夹路径组合与新增。 | `:22`、`:43` |
| `src/renderer/src/components/right-sidebar/LinksPanelRows.tsx` | 行点击/菜单以 shell preload 打开 URL。 | `:168`、`:198`、`:215` |

## 3. 恢复计划与实现覆盖差异

恢复计划目标是将 upstream 合并后的 ProjectLinks 持久化、repo IPC、preload contract 和 PlantUML bridge 恢复为可工作状态：[`docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md`](../../docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md)。SDD 台账只记录任务间接口顺序和在主工作树执行的理由：[`progress.md`](../../.superpowers/sdd/2026-09-07-restore-project-link-persistence/progress.md)。两份原始资料未修改。

| 恢复计划任务 | 当前源码观察 | 文档结论 |
| --- | --- | --- |
| Task 1：ProjectLinkPersistence | domain、Store composition、类型和默认值存在。 | 已有实现；缺少计划中指定的直接 persistence 测试。 |
| Task 2：repo lifecycle 清理 | renderer cache pruning 存在，但 main `deleteRepoScopedState` 未删 links/folders maps。 | 不完整；存在高风险清理缺口。 |
| Task 3：validated main IPC | focused handler 已存在，包含 repo 检查、normalization、notification、import/export。 | 实现存在；缺少计划中指定 IPC handler 测试。 |
| Task 4：preload contracts | focused bridge 和 `preload/index.ts` 暴露存在。 | 实现存在；缺少计划中指定 preload bridge 测试。 |
| Task 5：PlantUML fixture | 与本需求同一恢复计划但属于需求 02 PlantUML。 | 本需求不写入、不评估、不修改该范围。 |
| Task 6：测试、类型检查、macOS 构建 | 本次未执行。 | 不能声明完成或通过。 |

## 4. 已发现差异与待开发项

| 编号 | 差异/待开发项 | 事实证据 | 建议处理 |
| --- | --- | --- | --- |
| D1 | 删除 repo 时不清理项目 links/folders 持久化数据。 | `src/main/persistence/loading-store/repo-lifecycle-operations.ts:213` 只删 sparse presets、retired names、todos/lists。 | 最后 owner 删除和 orphan sweep 使用同一 `deleteRepoScopedState`，补删两张 map；保留 global。 |
| D2 | 导入 folder 规则不同于手工新增。 | 手工新增在 `project-link-handlers.ts:25` 校验；import parser `project-links-import-merge.ts:60` 仅 trim/filter。 | 提取/复用统一 normalizer；明确无效 folder 的整文件或逐项处理。 |
| D3 | 变更事件可能没有 renderer 消费者。 | preload bridge 在 `project-links-bridge.ts:9`、`:31` 提供监听；资料核对未找到 renderer 对 ProjectLinks change event 的订阅。 | 已加载 scope 接收通知后失效并刷新；避免多窗口陈旧。 |
| D4 | folder workspace owner key 未确认。 | local IPC 和 map 均以 `repoId` 作为 scope key。 | 明确 folder workspace 的稳定 key 或在无 key 时禁用 local scope；不能用临时路径推断。 |
| D5 | IPC reorder 输入约束有限。 | `normalizeUpdates` 仅规范化 category：`project-link-handlers.ts:36`。 | 评估对非有限 order、重复 ID、未知 ID 的拒绝/忽略语义。 |

## 5. 现有实现中的关键取舍

1. **local 与 global 分域**：global links 使用 `repoId=''` 的独立记录，不通过“所有 repo 复制一份”实现；避免复制冲突，但跨 scope 拖拽当前被直接忽略：`LinksPanel.tsx:179`。
2. **空文件夹独立声明**：folder 不仅由链接分类隐含，因此无链接分类也可显示；删除 folder declaration 不应隐式删除链接。
3. **导入重新发 ID**：输出不含 ID/时间戳，导入为目标 profile 创建新记录，降低跨 profile 冲突。
4. **安全优先的 URL 协议集合**：放弃 file/custom scheme 便利性，采用 save/import 和 open 两层 HTTP/HTTPS 检查。
5. **客户端 profile 所有权**：链接数据不迁移到 SSH execution host；这是控制面数据，不应用于判断远程执行状态。

## 6. 代码侧交接顺序

正式开发在评审关闭条件满足后，建议按以下顺序处理，避免将补文档误作实现完成：

1. 为 `ProjectLinkPersistence` 补 direct unit tests，先覆盖排序、local/global 隔离、folder 重复只保存一次。
2. 修复 `deleteRepoScopedState` 的 links/folders 清理，并扩展 `persistence-deregistered-repo-residue` fixture，验证 disk 落盘、global 保留、remote owner 例外。
3. 统一 import folder 与 UI folder normalizer，并用无效层级/空段/长度用例固定语义。
4. 为 main handler 补 mock `ipcMain`、Store、BrowserWindow、dialog/filesystem 的契约测试；覆盖 unknown repo、normalization、notification、import/export。
5. 为 preload bridge 补 invoke channel 与 onChanged listener 解绑测试。
6. 明确并实现 renderer listener 失效策略；补多窗口/多 renderer 验证。
7. 仅在用户/主 agent 确认后执行对应测试、`pnpm tc`、变更代码质量检查及必要的隔离 UI/打包验证。

## 7. 本阶段未执行项目

- 未修改项目业务代码或其他需求文档。
- 未运行 `pnpm test`、`pnpm tc`、lint、format、安装、构建或 `build:mac`。
- 未启动 Electron 应用、未打开原生文件对话框、未调用系统浏览器。
- 未执行正式评审、未批准发布或回滚。

因此本文件状态是“既有实现已整理；本阶段未开发、未执行核验”，不应被解读为测试通过或发布就绪。
