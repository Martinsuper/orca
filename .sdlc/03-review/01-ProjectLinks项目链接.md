# ProjectLinks 项目链接资料核对与待评审记录

> 需求名称：ProjectLinks项目链接
> 需求编号：01
> 日期：2026-09-20
> 状态：待评审（资料核对发现问题，非正式通过结论）
> 关联：[PRD](../01-prd/01-ProjectLinks项目链接.md) ｜ [设计文档](../02-design/01-ProjectLinks项目链接.md) ｜ [实现说明](../04-code/01-ProjectLinks项目链接.md) ｜ [测试计划](../05-test/01-ProjectLinks项目链接.md) ｜ [发布回滚清单](../06-deploy/01-ProjectLinks项目链接.md)
> 项目画像：Electron + React + TypeScript 桌面应用 ｜ 核对维度：架构、接口、安全、生命周期、前端兼容、测试、回滚

---

## 说明

本文是对现有代码、恢复计划和测试文件的**资料核对**，不是一次已完成的正式设计评审。本文不授予开发门禁放行，也不以“已有代码”或“已有测试文件”推断测试通过、发布批准或正式评审通过。

原计划和台账仅作为证据引用：[恢复计划](../../docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md) ｜ [SDD 台账](../../.superpowers/sdd/2026-09-07-restore-project-link-persistence/progress.md)。它们未在本次文档整理中修改或移动。

## 零、PRD 覆盖矩阵

| PRD 功能点/验收标准 | 现有设计或代码承接 | 覆盖状态 | 核对说明 |
| --- | --- | --- | --- |
| AC1：项目链接隔离、排序和重启持久化 | `ProjectLinkPersistence`、项目 Store/IPC/slice | ⚠️ 部分覆盖 | CRUD/排序实现存在；本次未运行持久化验证。 |
| AC2：URL 协议安全与打开 | normalization + shell URL handler | ⚠️ 部分覆盖 | 双层设计存在；已有单元测试未本次运行。 |
| AC3：文件夹、嵌套与空文件夹 | folder persistence + tree builder | ⚠️ 部分覆盖 | UI 创建路径有约束；导入路径不一致。 |
| AC4：同 scope 重排、跨 scope 不移动 | dnd guard + reorder IPC | ⚠️ 部分覆盖 | 逻辑和 tree 测试存在；未有 UI/Electron 运行证据。 |
| AC5：global 跨项目保留 | global Store records、global handlers | ⚠️ 部分覆盖 | 数据域已分离；项目删除和 global 保留组合回归待补。 |
| AC6：导入导出、schema 和重复合并 | export envelope、parse/merge functions | ⚠️ 部分覆盖 | parser/merge 单元测试存在；folder import 约束遗漏。 |
| AC7：最终 repo 删除清理 | repo lifecycle `deleteRepoScopedState` | ❌ 未覆盖 | 当前实现未清理 project links/folders 两张 map。 |
| AC8：跨平台、SSH/folder 边界 | client profile + SSH boundary 文档 | ⚠️ 部分覆盖 | SSH 原则明确；folder workspace owner key 未确认，跨平台未验证。 |

**覆盖度小结**：8 项验收中，已完全覆盖 0 项、部分覆盖 7 项、未覆盖 1 项。依据 SDLC 规则，存在未覆盖项时不能得出正式“通过”结论。

## 一、资料核对摘要

| 指标 | 值 |
| --- | --- |
| PRD 未覆盖 ❌ | 1 |
| 高风险问题 | 2 |
| 中风险问题 | 3 |
| 低风险改进 | 2 |
| 现有可引用测试文件 | 4 类 |
| 本次实际执行测试 | 0 |
| 正式评审结论 | 未形成 |
| 当前文档状态 | **待评审（非正式通过结论）** |

## 二、逐维度核对

| # | 维度 | 评级 | 资料核对结论 |
| --- | --- | --- | --- |
| 1 | 架构完整性 | ⚠️ | Renderer → preload → main IPC → Store 的分层明确，且 bridge 使用白名单；生命周期删除分支未完整承接链接数据。 |
| 2 | 数据与持久化 | ⚠️ | 默认值、旧 global 字段兼容、排序和 scheduleSave 清晰；repo 最终删除残留问题未闭环。 |
| 3 | 接口设计 | ⚠️ | local/global channel 和 typed preload 完整；folder remove 与 import 未一致地规范化路径，监听器未被 renderer 订阅。 |
| 4 | 核心流程与降级 | ⚠️ | 取消对话框、导入单条非法项跳过、shell 协议限制明确；多窗口缓存更新和 folder workspace owner key 未确认。 |
| 5 | URL 与安全边界 | ✅ | 保存/导入的 URL 规范化与 shell 打开双重只允许 HTTP/HTTPS；无直接 renderer shell/Node 暴露证据。 |
| 6 | 前端兼容性 | ⚠️ | 使用既有 shadcn primitives、i18n、load/error/empty 状态；尚无 macOS/Linux/Windows 或隔离 UI 运行证据。 |
| 7 | SSH 与 folder workspace | ⚠️ | SSH 不回退本机执行、客户端只拥有控制面符合规范；folder workspace 的稳定项目 owner key 未确认。 |
| 8 | 可观测性 | ⚠️ | 无已确认 metrics/日志方案；不得将 UI toast 或文件存在称为生产监控。 |
| 9 | 灰度与回滚 | ⚠️ | profile 新增 global 字段是可选兼容；未形成发布批准、备份流程或实际回滚演练证据。 |
| 10 | 容量与性能 | ⚠️ | 懒加载和内存树处理存在；没有规模数据、性能阈值或压测结论。 |
| 11 | 引用完整性 | ⚠️ | 主要 Store、IPC、preload、renderer、shell 和生命周期路径已找到；需补 Folder workspace owner 和 event listener 相关验证。 |
| 12 | 验收标准与权衡 | ❌ | AC7 当前未覆盖；其他项多为已有实现/测试文件，不足以标记为已验收。 |

## 三、风险项与关闭条件

### 高风险

| 编号 | 问题 | 影响与严重度说明 | 关闭条件 |
| --- | --- | --- | --- |
| HR-1 | `deleteRepoScopedState` 未删除 `projectLinksByRepo[repoId]` 与 `projectLinkFoldersByRepo[repoId]`。 | 项目被最终删除后，资料可能在本机 profile 留存，造成数据生命周期不一致、潜在隐私暴露和 profile 增长。归为高风险而非武断 P0：现有链接不影响应用启动、没有服务端或资金安全影响，但违背明确的删除语义。 | 在最后 owner 删除和 orphan sweep 中删除两张 map；增加持久化落盘回归测试，确认 global records 与仍被其他 host 拥有的 repo 不受影响。 |
| HR-2 | 导入 folder 仅 trim/filter，未应用层级/长度/空段规范化。 | 手工创建与导入产生不同数据约束，异常路径可能破坏树的可预期结构或让无效 path 持久化。 | 复用单一 folder normalizer；决定“无效 folder 跳过”还是“整个文件拒绝”；测试两种来源得到一致结果。 |

### 中风险

| 编号 | 问题 | 影响与严重度说明 | 关闭条件 |
| --- | --- | --- | --- |
| MR-1 | preload 提供 change listener，但 renderer 未发现订阅。 | 同一窗口乐观更新正确不代表多个窗口/renderer 自动刷新；用户可能看到陈旧列表。 | 设计失效策略并订阅 `onChanged/onGlobalChanged`；验证 listener 清理和已加载 bucket 刷新。 |
| MR-2 | folder workspace 的项目数据 owner 未确认。 | API 以 `repoId` 为键；若 folder workspace 没有稳定 repo ID，可能无法满足隔离或出现无数据。 | 明确 folder workspace 的 stable owner key 与无 key 时 UX；不得仅用临时路径猜测。 |
| MR-3 | IPC/preload/persistence 关键测试缺失。 | main 端校验、通知和 Store scheduler 的回归不受 renderer slice 测试完整覆盖。 | 新增 persistence、IPC handler、preload bridge 三类测试并实际运行、记录结果。 |

### 低风险与改进

| 编号 | 问题 | 关闭条件 |
| --- | --- | --- |
| LR-1 | `reorder` 的 `order`/ID 输入约束较弱。 | 明确是否要求有限数值、去重 ID、仅更新现有 link；补边界测试。 |
| LR-2 | 无已确认可观测性与导入错误分类。 | 在不记录 URL/名称的前提下确定匿名错误/诊断策略，或明确本期不采集。 |

## 四、测试证据核对

| 层次 | 现有文件 | 可证明的范围 | 本次状态 |
| --- | --- | --- | --- |
| URL normalization | `src/main/ipc/project-link-normalization.test.ts` | 名称/分类/URL 限制和危险 scheme 拒绝 | 文件已读，未运行 |
| import merge | `src/main/ipc/project-links-import-merge.test.ts` | envelope、future schema、无效链接跳过、链接/文件夹去重 | 文件已读，未运行 |
| renderer slice | `src/renderer/src/store/slices/project-links.test.ts` | load/error、乐观更新、回滚、排序、folder、global、导入后刷新 | 文件已读，未运行 |
| tree/reorder | `src/renderer/src/components/right-sidebar/project-links-tree.test.ts` | 分类树、空 folder、重排与跨分类移动 | 文件已读，未运行 |
| lifecycle | `src/main/persistence-deregistered-repo-residue.test.ts` | 通用 orphan repo sweep 与 remote session 例外 | 已读，未覆盖 ProjectLinks maps |
| persistence domain | 未发现 `project-link-persistence.test.ts` | 应测试排序、scheduleSave、global/local 隔离、folder duplicate | 缺失 |
| IPC handlers | 未发现 `repos-project-links.test.ts` | 应测试 repo 校验、通知、导入/导出和 folder 校验 | 缺失 |
| preload bridge | 未发现 `project-links-bridge.test.ts` | 应测试 channel 调用及 listener 精确解绑 | 缺失 |
| visible UI / 原生行为 | 未发现目标 ProjectLinks Electron 测试证据 | 应测试 dialog、拖拽、系统打开、文件对话框 | 缺失；只能在隔离 CI 执行 |

## 五、正式评审前必须提供的材料

1. HR-1、HR-2 的设计决策和修复 diff，或用户明确接受其残余风险的记录。
2. folder workspace owner 的明确产品与技术定义。
3. 新增 persistence、IPC、preload 三类测试，及实际命令、通过/失败原始结果。
4. 使用 `ORCA_BACKGROUND_LAUNCH=1` 的非抢焦点验证方案；可见 UI、原生文件对话框或系统浏览器行为仅在隔离显示器/CI 执行。
5. 跨平台兼容说明，至少明确 macOS、Linux、Windows 的验证责任人、环境和结果。
6. 发布前 profile 备份、兼容读取、回滚步骤和负责人/时间窗口。

## 六、当前结论

**结论：待评审（资料核对发现问题，非正式通过结论）。**

现有实现已覆盖链接 CRUD、全局数据域、URL 双层校验、文件夹树、导入导出和 renderer 乐观更新等主要路径；但项目最终删除清理和导入 folder 规范化存在明确缺口，测试也未形成本阶段的实际运行证据。完成高风险关闭条件并补齐证据前，不可据此文档宣称“评审通过”、进入正式开发放行、测试通过或发布批准。
