# ProjectLinks 项目链接发布与回滚清单

> 需求名称：ProjectLinks项目链接
> 需求编号：01
> 日期：2026-09-20
> 状态：未执行（仅发布/回滚资料整理，未批准发布）
> 关联：[PRD](../01-prd/01-ProjectLinks项目链接.md) ｜ [设计文档](../02-design/01-ProjectLinks项目链接.md) ｜ [评审记录](../03-review/01-ProjectLinks项目链接.md) ｜ [实现说明](../04-code/01-ProjectLinks项目链接.md) ｜ [测试计划](../05-test/01-ProjectLinks项目链接.md)
> 项目画像：Electron + React + TypeScript 桌面应用 ｜ 启用检查项：[frontend-compat]

---

## 一、发布信息

| 项目 | 内容 |
| --- | --- |
| 上线主题 | ProjectLinks 本地持久化、链接管理、分类、导入导出与安全打开能力 |
| 发布版本 | 待定 |
| 发布人员 | 待定 |
| 测试人员 | 待定 |
| 审批人员 | 待定 |
| 发布时间窗口 | 待定 |
| 是否已批准发布 | 否 |
| 是否有服务端/SQL/动态配置 | 无服务端、无 SQL、未发现动态配置变更 |
| 数据所有权 | 客户端本机 Orca profile；不是 SSH execution host 数据 |
| 关联历史资料 | [恢复计划](../../docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md) ｜ [SDD 台账](../../.superpowers/sdd/2026-09-07-restore-project-link-persistence/progress.md)，仅引用 |

本清单不代表已上线。发布前必须先获得正式评审结论、实际测试结果、负责人和时间窗口；不能把既有代码、文档补全或历史提交当作发布批准。

## 二、变更范围

| 范围 | 变更/现有实现 | 发布影响 |
| --- | --- | --- |
| shared model | `ProjectLink`、persisted state project/global fields、默认 state | 已有 profile 需兼容可选 global 字段。 |
| Store persistence | `ProjectLinkPersistence` 与 Store composition | 链接/文件夹保存至本机 profile。 |
| repo lifecycle | 应在最终 repo 删除时清理项目 links/folders；当前发现遗漏。 | 发布前必须关闭高风险 D1。 |
| main IPC | ProjectLinks CRUD、folders、import/export、URL normalization | renderer 只能经 preload 调用。 |
| preload | typed project links/folders bridge | mixed build 时 channel/API 名称必须一致。 |
| renderer | LinksPanel、管理/文件夹对话框、tree、Zustand slices | local/global UI、拖拽、导入导出反馈。 |
| shell | 仅 HTTP/HTTPS 的系统默认浏览器打开 | 不允许 file/javascript/data/custom scheme。 |
| 外部资源 | 原生文件对话框、系统浏览器 | 用户取消不能被误报为错误或成功。 |

## 三、发布前置门禁

| 编号 | 门禁 | 状态 | 负责人/证据 |
| --- | --- | --- | --- |
| G1 | PRD、设计、资料核对完成，正式评审结论明确。 | 未完成 | 当前 [评审记录](../03-review/01-ProjectLinks项目链接.md) 是待评审。 |
| G2 | 关闭 repo lifecycle links/folders 残留问题。 | 未完成 | D1 / HR-1。 |
| G3 | 统一导入与手工 folder path 规范化。 | 未完成 | D2 / HR-2。 |
| G4 | 确认 folder workspace stable owner key。 | 未完成 | OQ4。 |
| G5 | 增补并运行 persistence、IPC、preload 测试。 | 未完成 | 测试计划 PL-PER/PL-IPC/PL-PRE。 |
| G6 | 运行现有与新增 targeted tests、`pnpm tc`、changed code quality 检查。 | 未完成 | 当前没有执行证据。 |
| G7 | 隔离 CI/显示器完成所需可见 UI、原生文件对话框和跨平台验证。 | 未完成 | 使用 `ORCA_BACKGROUND_LAUNCH=1`；不得抢用户焦点。 |
| G8 | 完成 profile 备份与恢复演练。 | 未完成 | 发布人待定。 |
| G9 | 版本、发布人、窗口和回滚负责人明确。 | 未完成 | 待定。 |

任何 G1-G9 未关闭时，不应执行正式发布。

## 四、备份与兼容性

### 4.1 发布前备份

1. 由发布人员确认当前 profile 数据目录和备份位置；不得在文档中记录个人路径、URL、链接名称或凭据。
2. 在关闭 Orca 或确保 profile 写入已稳定后，创建可恢复的 profile 备份；记录备份校验/恢复负责人，而非敏感内容。
3. 选择包含以下样本的非敏感测试 profile：项目 links、global links、空 folder、嵌套 folder、无 `order` 的旧链接和待导入 JSON。
4. 确认恢复操作不会覆盖用户后续创建的数据；如需要覆盖，必须由用户明确确认。

### 4.2 兼容性检查

| 项目 | 兼容要求 | 发布前验证 |
| --- | --- | --- |
| 旧 profile | 缺少 `globalProjectLinks`/`globalProjectLinkFolders` 时按空集合读取。 | 使用旧字段缺失 fixture 或备份副本验证。 |
| 旧 link | 缺少 `order` 时稳定排在有 order 链接之后。 | persistence test。 |
| 导出文件 | 新版本应写 kind/schemaVersion；高于当前支持版本的文件必须拒绝。 | import/export test。 |
| mixed renderer/main | preload 方法与 main handler channel 完全一致。 | preload/IPC contract tests。 |
| 跨平台 | macOS、Linux、Windows 均经 Electron shell 和原生 dialog 正常工作。 | CI matrix 或受控测试机。 |
| SSH | URL 打开发生在客户端，不执行远端文件/命令，不以断连推断远端状态。 | 隔离 SSH 测试与边界检查。 |
| folder workspace | owner key 由明确决策提供，不能假定 git worktree。 | OQ4 关闭后验证。 |

## 五、建议发布步骤与逐步回滚

| 节奏 | 执行步骤 | 观察点 | 回滚步骤 |
| --- | --- | --- | --- |
| 0：预演 | 在隔离 CI/profile 执行完整测试矩阵、类型检查、UI/原生测试；确认 D1/D2 关闭。 | 测试数、失败数、profile 样本、无焦点抢占。 | 停止发布；保留测试证据和备份，不触碰用户 profile。 |
| 1：内部灰度 | 仅由指定内部测试人员安装候选构建，使用非敏感 profile 验证 CRUD、排序、导入导出和 URL guard。 | crash、保存失败、导入失败、错误 toast、profile 数据完整性。 | 卸载/回退客户端构建；从发布前备份恢复测试 profile。 |
| 2：受控放量 | 在明确版本和窗口后向有限用户发布。 | 用户反馈、错误诊断、links/folders 残留、跨窗口陈旧问题。 | 停止扩散，回退到上一兼容构建；不删除 profile 数据。 |
| 3：全量 | 所有门禁、灰度观察和负责人确认后发布。 | 安装成功、启动健康、核心路径、支持请求。 | 停止全量，发布回退版本，按用户授权恢复 profile。 |

本功能没有服务端灰度、数据库变更或动态业务开关。客户端分批发布和可恢复 profile 备份是主要风险控制手段；不得承诺未实际存在的远程 feature flag。

## 六、发布后验证清单

| 分类 | 检查项 | 正常 | 异常 | 证据/负责人 |
| --- | --- | --- | --- | --- |
| 安装与启动 | 客户端安装、首次启动和已有 profile 加载正常。 | ☐ | ☐ | 待定 |
| 项目链接 | 新增、编辑、删除项目链接后重启仍保留且按排序显示。 | ☐ | ☐ | 待定 |
| 全局链接 | global link 在不同项目可见，项目删除后仍保留。 | ☐ | ☐ | 待定 |
| 文件夹 | 空文件夹、嵌套、重复路径、删除声明行为符合已确认语义。 | ☐ | ☐ | 待定 |
| URL 安全 | HTTP/HTTPS 可打开；危险 scheme 无法保存或打开。 | ☐ | ☐ | 待定 |
| 导出 | 输出文件 schema、数量和字段符合格式，不泄漏 ID/时间戳。 | ☐ | ☐ | 待定 |
| 导入 | 重复规则、future schema 拒绝、无效 link/folder 策略正确。 | ☐ | ☐ | 待定 |
| 生命周期 | 最终 repo 删除后 links/folders 清理；其他 host owner/global 不误删。 | ☐ | ☐ | 待定 |
| 多窗口 | 变更通知后的缓存失效策略符合决定。 | ☐ | ☐ | 待定 |
| SSH/folder workspace | 不产生远端文件/命令回退；owner key 语义正确。 | ☐ | ☐ | 待定 |
| 资源与稳定性 | 无异常崩溃、明显卡顿或持续 profile 重写。 | ☐ | ☐ | 待定 |

可见 UI 或原生验证只能在隔离 CI/显示器完成，并应使用 `ORCA_BACKGROUND_LAUNCH=1`；不得通过显示或聚焦窗口抢占用户桌面。

## 七、回滚策略

### 7.1 触发条件

- 项目删除后仍残留 links/folders 或误删 global/其他 host owner 数据。
- 导入接受不合规 folder path、破坏分类树，或错误合并用户链接。
- 非 HTTP/HTTPS URL 被保存或打开。
- 候选版本导致启动、profile 加载、preload IPC、LinksPanel 关键路径失败。
- 多窗口陈旧数据造成用户错误删除/编辑，且无可接受缓解。

### 7.2 回滚步骤

1. 立即停止候选版本继续分发，记录版本、时间、受影响范围和回滚负责人。
2. 指引受影响用户回退到最近一个**确认能够读取当前 profile 格式**的客户端构建；未知兼容性时先在备份副本验证，不能直接覆盖用户数据。
3. 不删除 `projectLinksByRepo`、`projectLinkFoldersByRepo`、global records 或导出文件来“修复”问题；先备份并取得用户授权。
4. 若问题只影响候选测试 profile，从发布前备份恢复；若影响真实用户 profile，提供逐用户的恢复路径和结果记录。
5. 回退后复核：客户端可启动、旧数据可读、HTTP/HTTPS guard 仍有效、错误版本不再发布。
6. 将根因、受影响版本、数据恢复结果和补测案例回写到后续正式故障/发布记录；本文件不替代故障记录。

## 八、未执行声明

截至 2026-09-20：发布人员、版本、窗口、审批、测试执行、备份演练、隔离 UI 验证、构建产物检查和正式发布均为待定或未执行。本文件为可交接清单，不能作为“已上线”“已回滚”“已验证”的证据。
