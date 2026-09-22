# ProjectLinks 项目链接设计文档

> 需求名称：ProjectLinks项目链接
> 需求编号：01
> 日期：2026-09-20
> 状态：待评审（既有实现资料整理）
> 关联：[PRD](../01-prd/01-ProjectLinks项目链接.md) ｜ [评审记录](../03-review/01-ProjectLinks项目链接.md) ｜ [实现说明](../04-code/01-ProjectLinks项目链接.md) ｜ [测试计划](../05-test/01-ProjectLinks项目链接.md) ｜ [发布回滚清单](../06-deploy/01-ProjectLinks项目链接.md)
> 项目画像：Electron + React + TypeScript 桌面应用 ｜ 启用章节：[frontend-compat] ｜ 不使用 PlantUML：本文件为既有实现证据整理，使用文本箭头和表格。

---

## 〇、设计目标与边界

当前实现将 ProjectLinks 设计为本机 Electron profile 中的轻量导航数据：renderer 负责展示和乐观状态，preload 仅暴露强类型 IPC，main process 负责校验、文件对话框、系统 URL 打开与 Store 持久化。链接不是远端资源代理，不执行 URL 内容，不读取 SSH host 文件，也不把 SSH 连接状态当成链接可用性证据。

文本数据流：

`LinksPanel / 对话框 → Zustand ProjectLinksSlice → window.api.projectLinks/projectLinkFolders → preload IPC bridge → main project-link handlers → Store ProjectLinkPersistence → profile persisted state → scheduler 保存`

`链接行点击 → window.api.shell.openUrl → shell IPC 重新解析 URL → Electron shell.openExternal`

## 一、页面与交互入口

| 视图/入口 | 实际位置 | 现有职责 | 关键实现 |
| --- | --- | --- | --- |
| Links 面板 | 右侧栏 | 加载 local/global 数据、展示树、触发新增/管理/导入/导出、处理拖拽 | `src/renderer/src/components/right-sidebar/LinksPanel.tsx:41` |
| 管理对话框 | Links 面板 | 在 local/global tab 新增、编辑和删除链接 | `src/renderer/src/components/right-sidebar/ProjectLinksManagerDialog.tsx:28` |
| 文件夹对话框 | Links 面板 | 新建顶级或子文件夹，组合父路径 | `src/renderer/src/components/right-sidebar/ProjectLinkFolderDialog.tsx:22` |
| 链接树 | Links 面板 | 从分类和文件夹声明构造树、计算拖拽更新 | `src/renderer/src/components/right-sidebar/project-links-tree.ts` |
| 链接行 | Links 面板 | 点击/菜单打开 URL、同分类新建、删除 | `src/renderer/src/components/right-sidebar/LinksPanelRows.tsx:168` |
| renderer 状态 | Zustand slice | 懒加载、load/error 状态、乐观 CRUD、失败回滚、重排与导入后刷新 | `src/renderer/src/store/slices/project-links.ts:27` |

UI 使用既有 `Button`、`Dialog`、`Input`、`ContextMenu`、`Tabs` 和 `translate`；链接管理没有新增色板、字体或自定义 primitive。新增/管理操作使用 local/global 两个明确 scope；空面板、加载和读取失败均有独立渲染分支：`LinksPanel.tsx:220`、`:228`、`:307`。

## 二、领域模型与持久化

### 2.1 数据模型

| 字段/记录 | 语义 | 存储规则 |
| --- | --- | --- |
| `ProjectLink.id` | 链接唯一 ID | 新建/导入时由 main process `randomUUID()` 生成。 |
| `repoId` | scope 归属 | 项目链接为注册 repo ID；全局链接固定为空字符串。 |
| `name` / `url` / `category` | 用户可编辑数据 | main process 规范化后保存。 |
| `order?` | 分类内手工顺序 | 缺失的旧记录排在最后。 |
| `createdAt` / `updatedAt` | 生命周期时间 | 编辑保留原创建时间，刷新更新时间；导入重新生成。 |
| `projectLinksByRepo` | 项目链接 map | `Record<repoId, ProjectLink[]>`。 |
| `projectLinkFoldersByRepo` | 项目空文件夹 map | `Record<repoId, string[]>`；路径为 `/` 连接。 |
| `globalProjectLinks?` / `globalProjectLinkFolders?` | 全局 scope | 可选字段，旧 profile 缺失时作为空集合。 |

类型和持久化声明位于 `src/shared/types.ts:6`、`src/shared/persisted-state-types.ts:68`；新 profile 默认创建两张项目 map：`src/shared/constants.ts:143`。

### 2.2 Store 域

`ProjectLinkPersistence` 是 Store composition 的领域对象：`src/main/persistence/loading-store/project-link-persistence.ts:23`。所有状态变化通过 `scheduleSave`，不直接写 profile 文件。

| 操作 | 行为 | 证据 |
| --- | --- | --- |
| `getProjectLinks` / `getGlobalProjectLinks` | 返回复制后的排序数组 | `project-link-persistence.ts:30`、`:89` |
| `save*ProjectLink` | 按 ID 插入或替换，然后安排保存 | `:36`、`:93` |
| `remove*ProjectLink` | 过滤 ID，然后安排保存 | `:46`、`:103` |
| `reorder*ProjectLinks` | 仅更新请求中的 category/order，然后安排保存 | `:54`、`:111` |
| `get*ProjectLinkFolders` | 返回字典序排序副本 | `:66`、`:121` |
| `add*ProjectLinkFolder` | 仅不存在时追加并保存 | `:72`、`:127` |
| `remove*ProjectLinkFolder` | 过滤路径并保存 | `:81`、`:136` |

排序约定是 `(order ?? Infinity)` 升序、再 `name.localeCompare`：`project-link-persistence.ts:15`。renderer 的乐观排序使用相同规则：`src/renderer/src/store/slices/project-links.ts:16`。

该 domain 已由 `StoreDomains` 创建、安装 context 并通过 declaration merge 暴露给 Store：`src/main/persistence/loading-store/store-domain-composition.ts:73`、`:100`、`:121`、`:142`；`src/main/persistence/loading-store/store.ts:110`。

### 2.3 删除清理设计与现状差异

设计目标是：项目最终 owner 删除时，同时删除该 repo 的 links 与 folders；保留 global records。`removeProjectForHost` 已正确判断“是否仍存在相同 repo ID 的 host owner”：`src/main/persistence/loading-store/repo-lifecycle-operations.ts:90`、`:100`。启动 orphan sweep 也明确将 `runtime:*` host 例外于本机 catalog 缺失推断：`:134`。

但实现中的 `deleteRepoScopedState` 当前只删除 sparse presets、retired worktree names、todos 和 todo lists，没有删除 `projectLinksByRepo` 或 `projectLinkFoldersByRepo`：`:213`。因此设计与当前实现存在高优先级差异，详见评审记录；不能把现有能力描述为已满足 R6。

renderer 内存缓存会在 repo 删除时裁剪 links/folders/loading/error maps：`src/renderer/src/store/slices/project-links-repo-pruning.ts:12`，但这不替代 profile 持久化清理。

## 三、IPC 与 preload 契约

### 3.1 进程边界

`registerRepoHandlers` 注册 project-link handler：`src/main/ipc/repos.ts:21`、`:83`。main handler 先移除旧 channel 以支持 macOS 重新激活后重注册：`src/main/ipc/repos/project-link-handlers.ts:50`。preload bridge 通过 `satisfies PreloadApi[...]` 暴露白名单方法：`src/preload/api/project-links-bridge.ts:4`、`:27`，并由 `src/preload/index.ts:103`、`:114` 注入 `window.api`。

### 3.2 项目与全局 channel

| Channel | 参数/返回 | 主进程行为 | 通知 |
| --- | --- | --- | --- |
| `projectLinks:list` | `{repoId}` → `ProjectLink[]` | 返回项目排序列表 | 无 |
| `projectLinks:save` | repo、可选 ID、name/url/category → link | 验证 repo，规范化，生成/保留 ID 与时间 | `projectLinks:changed({repoId})` |
| `projectLinks:remove` | repo、linkId | 验证 repo，删除 | 同上 |
| `projectLinks:reorder` | repo、`{id,category,order}[]` | 验证 repo，规范化 category，更新 | 同上 |
| `projectLinkFolders:list/add/remove` | repo、path | 项目范围文件夹操作；add 校验 repo/路径 | `projectLinkFolders:changed({repoId})` |
| `projectLinks:listGlobal/saveGlobal/removeGlobal/reorderGlobal` | 无 repo 或 global link 参数 | 读写 global array，写入 `repoId=''` | `projectLinks:globalChanged` |
| `projectLinkFolders:listGlobal/addGlobal/removeGlobal` | global path 参数 | 读写 global folder array | `projectLinkFolders:globalChanged` |
| `projectLinks:export/import` | `{repoId}` → structured result | 原生对话框、JSON 读写/合并 | 仅插入数据时通知 |

项目 scope 写操作均使用 `store.getRepo(repoId)` 拒绝未知 repo：`project-link-handlers.ts:81`、`:107`、`:127`。list 操作没有对应 repo existence check，属于只读空 bucket 行为；后续若收紧契约需避免破坏 lazy UI 或旧 profile 恢复。

### 3.3 事件消费差异

preload 已提供 `onChanged`、`onGlobalChanged` 并返回解绑函数：`src/preload/api/project-links-bridge.ts:9`、`:18`、`:31`、`:39`。本次资料核对未在 renderer 搜到这些 ProjectLinks 事件的订阅；现有同窗口一致性主要依赖 slice 乐观更新和导入后的显式刷新：`src/renderer/src/store/slices/project-links-transfer.ts:47`。多窗口或其他 renderer 的变更自动失效尚未被证实。

## 四、输入校验、URL 安全与打开行为

### 4.1 链接字段规范化

| 输入 | 规则 | 实现 |
| --- | --- | --- |
| 名称 | trim 后必填，最多 80 | `src/main/ipc/project-link-normalization.ts:9` |
| 分类 | trim，可空，最多 40 | `:20` |
| URL | trim；无 scheme 时加 `https://`；解析失败拒绝；仅 http/https；最多 2048 | `:29` |
| 排序更新 | 仅规范化 category；当前未额外校验 ID 或有限 `order` | `src/main/ipc/repos/project-link-handlers.ts:36` |
| 文件夹手工新增 | 分段 trim、去空段、最多 5 层、每段最多 40 | `:25` |

安全策略采用两层防御：保存/导入时 `normalizeProjectLinkUrl` 拒绝危险 scheme，打开时 shell handler 再解析并仅调用 `shell.openExternal` 处理 HTTP/HTTPS：`src/main/ipc/shell.ts:79`。renderer 不使用裸 `window.open`；链接行通过 `window.api.shell.openUrl`：`LinksPanelRows.tsx:193`、`:215`。

### 4.2 文件夹与分类树

- 分类字段自身可为 `/` 路径；tree builder 将“生产/数据库”等路径建立为嵌套节点。
- 空分类显示为本地化的“Uncategorized”，并以平铺 bucket 呈现：`src/renderer/src/components/right-sidebar/project-links-tree.test.ts:32`。
- 独立 folder declaration 可让无链接分类保持可见；若链接已隐含同一路径，tree 合并而不是重复节点：`:40`、`:61`。
- 文件夹删除 handler 目前直接使用传入 path，没有再调用 `normalizeFolderPath`：`project-link-handlers.ts:137`。正常 UI 传递已保存路径，但 IPC 契约的一致性需在评审中确认。

## 五、导入与导出格式、合并规则

### 5.1 文件 envelope

```text
{
  kind: 'orca-project-links',
  schemaVersion: 1,
  exportedAt: <Unix ms>,
  links: [{ name, url, category, order? }],
  folders: ['分类/子分类']
}
```

共享类型在 `src/shared/project-links-export.ts:5`。导出时不携带 ID/时间戳，从而避免跨 profile 冲突：`:13`。主进程采用原生 save dialog，默认文件名为 `<repo displayName>.orca-links.json`：`src/main/ipc/repos/project-link-handlers.ts:185`。

### 5.2 导入规则

1. envelope 必须为对象、kind 匹配、schemaVersion 为 number；高于当前版本的文件整体拒绝，避免静默丢字段：`src/main/ipc/project-links-import-merge.ts:22`。
2. 每条 link 必须通过 name/URL/category 同一规范化器；单条无效则跳过，不使有效 sibling 失败：`:40`。
3. 合并 key 为 `(url, category.trim())`；同 URL 不同分类允许；已有重复记为 `skipped`，文件内重复记为 `duplicatesInFile`：`:75`。
4. 新插入 link 在目标 repo 重新生成 ID、createdAt/updatedAt：`project-link-handlers.ts:246`。
5. 导入成功后仅当实际插入 links/folders 时发送对应 change notification：`:253`。

**已发现差异**：`parseProjectLinksExport` 对 folders 只做“字符串、trim、非空”过滤：`project-links-import-merge.ts:60`；之后 handler 直接调用 Store add：`project-link-handlers.ts:250`。它没有复用手工新增的层级、单段长度、空段归一化规则。因此导入可产生与 UI 创建规则不同的 folder path，需修复或由产品明确接受。

## 六、跨平台、SSH 与 folder workspace

| 关注点 | 设计约束 | 现有证据/待确认 |
| --- | --- | --- |
| macOS/Linux/Windows | Electron shell API 和原生文件对话框承担平台差异；UI 使用通用 primitives。 | 需在隔离 CI/各平台验证，不以本机 macOS 推断通过。 |
| SSH | 执行 host 拥有执行、凭据、文件和进程；客户端拥有 UI/控制面。链接仅为客户端 profile 数据。 | `docs/reference/ssh-execution-boundary.md:5`。 |
| SSH 断连 | 断连不代表远端进程退出；本功能不报告进程状态。 | 不得新增 `exited` 等推断。 |
| folder workspace | 链接项目 scope API 以 repo ID 为 key。 | 需确认 folder workspace 是否具备可用且稳定的 repo ID，不能假设 git worktree。 |
| 打开链接 | URL 由客户端系统默认浏览器打开，不表示在远端 SSH host 打开。 | 已实现；产品文案不应暗示远端浏览器行为。 |

## 七、兼容性与异常策略

| 场景 | 处理策略 |
| --- | --- |
| 旧 profile 没有 global fields | `?? []` 读取，保持旧数据可用。 |
| 链接无 `order` | 排在手工排序链接之后，以名称稳定排序。 |
| renderer load 失败 | slice 记录 `error`，不标记 loaded；后续请求可重试。 |
| 删除/重排/文件夹乐观更新失败 | slice 恢复此前缓存并向调用者抛错，由 UI toast/错误处理反馈。 |
| 用户取消导入/导出对话框 | 返回 `{ok:false,cancelled:true}`，不视为错误。 |
| 导入文件结构错误/未来版本 | 返回 `{ok:false,error}`，不部分写入。 |
| 单条导入链接非法 | 跳过单条，保留有效 entries。 |
| 没有当前 repo | local 写操作拒绝；Links 面板显示空态。 |
| main window 已销毁 | handler `notify` 不向已销毁窗口发送消息。 |

## 八、性能与可观测性

没有已确认的性能预算、监控指标或用户数量数据，不能声称 P99 或容量结果。现有设计为按需加载当前 repo bucket 和 global bucket，避免初始加载全部项目链接：`LinksPanel.tsx:81`、`:93`。tree 和排序是 renderer 内存中的数组处理；大规模链接数量、导入大文件和多窗口并发尚无量化证据。

建议后续至少记录：导入失败原因、持久化失败次数、JSON schema 拒绝次数和 URL 规范化拒绝次数；不得上报 URL、名称或其他用户敏感内容，除非另有隐私决策。

## 九、引用梳理

| 类型 | 已找到的引用/影响面 |
| --- | --- |
| 类型与默认值 | `src/shared/types.ts`、`src/shared/persisted-state-types.ts`、`src/shared/constants.ts` |
| Store | `src/main/persistence/loading-store/project-link-persistence.ts`、`store-domain-composition.ts`、`store.ts` |
| 生命周期 | `src/main/persistence/loading-store/repo-lifecycle-operations.ts`、`src/main/persistence-deregistered-repo-residue.test.ts` |
| main IPC | `src/main/ipc/repos.ts`、`src/main/ipc/repos/project-link-handlers.ts`、normalization/import merge modules |
| preload | `src/preload/api/project-links-todos-api.ts`、`project-links-bridge.ts`、`src/preload/index.ts` |
| renderer | ProjectLinks Zustand slices、LinksPanel、manager/folder dialogs、tree/rows |
| URL 打开 | `src/preload/api/shell-bridge.ts`、`src/main/ipc/shell.ts` |
| 计划与台账 | [恢复计划](../../docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md) ｜ [SDD 台账](../../.superpowers/sdd/2026-09-07-restore-project-link-persistence/progress.md)，仅引用，不修改或移动。 |

## 十、风险与取舍

| # | 类型 | 描述 | 影响面 | 应对/缓解 |
| --- | --- | --- | --- | --- |
| 1 | 高风险 | repo lifecycle 只清理部分 repo-scoped state，项目 links/folders 可在最终删除后留在 profile。 | 隐私、数据一致性、profile 膨胀 | 在 `deleteRepoScopedState` 增加两张 map 的删除，并为最终删除/remote owner 保留写测试。 |
| 2 | 高风险 | 导入 folders 未复用手工 path 规范化。 | 分类树结构一致性 | 在 parse 或 import handler 复用同一校验；对不合规项定义跳过/整体拒绝策略。 |
| 3 | 中风险 | preload 有 change listeners，renderer 未消费。 | 多窗口/多 renderer 陈旧缓存 | 已加载 bucket 收到事件后失效并重取；测试订阅解绑。 |
| 4 | 中风险 | folder workspace scope 的 repo ID 语义未在资料中明确。 | folder workspace 隔离 | 产品和工程确认稳定 owner key；没有可靠 key 时显示不可用或采用独立 workspace key，不得猜测。 |
| 5 | 权衡 | global 和 local 保持独立存储，跨 scope 拖拽忽略。 | 一次操作移动链接的便捷性 | 避免隐式复制/删除；未来单独设计 copy/move 语义。 |
| 6 | 权衡 | 只允许 http/https。 | 无法直接打开本地文件或定制协议 | 换取可预期、安全的外部打开边界。 |

## 十一、验收标准回链

| # | PRD 验收标准 | 设计承接机制 | 覆盖程度 |
| --- | --- | --- | --- |
| AC1 | 项目隔离、持久化与排序 | §二 Store、§三 IPC、§七兼容 | 部分：实现存在，未形成本次运行证据。 |
| AC2 | URL 安全与打开 | §四双层校验和 shell 打开 | 部分：单元测试存在，未本次运行。 |
| AC3 | 文件夹与空态 | §四分类树、folder declaration | 部分：tree 测试存在；导入规范化有差异。 |
| AC4 | scope 内重排、跨 scope 忽略 | §一拖拽、§三 IPC、§四排序 | 部分：tree/slice 证据存在，未做 UI 运行验证。 |
| AC5 | global 数据独立 | §二模型、§三 global channel | 部分：实现存在，项目删除保留 global 的回归证据待补。 |
| AC6 | 导入导出与去重 | §五 envelope/merge | 部分：parser/merge 测试存在；folder 一致性待修。 |
| AC7 | 最终 repo 删除清理 | §二.3 生命周期 | 未覆盖：当前代码发现遗漏，需修复与测试。 |
| AC8 | 跨平台/SSH/folder 边界 | §六 | 部分：架构约束明确；各环境验证和 folder owner 决策待完成。 |
