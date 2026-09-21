# ProjectLinks 项目链接测试计划与已有证据

> 需求名称：ProjectLinks项目链接
> 需求编号：01
> 日期：2026-09-20
> 状态：未执行（仅整理已有测试文件与待测案例）
> 关联：[PRD](../01-prd/01-ProjectLinks项目链接.md) ｜ [设计文档](../02-design/01-ProjectLinks项目链接.md) ｜ [评审记录](../03-review/01-ProjectLinks项目链接.md) ｜ [实现说明](../04-code/01-ProjectLinks项目链接.md) ｜ [发布回滚清单](../06-deploy/01-ProjectLinks项目链接.md)

---

## 一、测试范围与证据原则

本计划覆盖 ProjectLinks 的 shared validation、main persistence/IPC、preload、renderer Zustand state、分类树、导入导出、repo lifecycle、SSH/folder workspace 边界与可见 UI。

**证据原则：**测试文件存在、历史计划写有预期、代码看起来可执行，都不等于测试通过。本次只读文档整理没有运行任何命令，所有“已有测试”状态均为“未执行”。不得把本文件的案例设计、待补测试或历史提交当作回归已通过证据。

## 二、已有测试文件与当前覆盖

| 证据 ID | 文件 | 已覆盖行为 | 本次执行状态 | 缺口 |
| --- | --- | --- | --- | --- |
| E-01 | `src/main/ipc/project-link-normalization.test.ts` | 名称/分类 trim、长度限制；裸 host 补 HTTPS；HTTP 保留；空 URL、javascript/file/data、超长 URL 拒绝。 | 未执行 | 未覆盖 shell handler 第二层和 IPC error 返回。 |
| E-02 | `src/main/ipc/project-links-import-merge.test.ts` | export envelope、future schema 拒绝、单条异常 link 跳过、链接 `(url,category)` 去重、文件夹已有重复跳过。 | 未执行 | 未覆盖 folder 层级/长度 normalizer 一致性、实际文件对话框和 Store 写入。 |
| E-03 | `src/renderer/src/store/slices/project-links.test.ts` | repo/global fetch、load guard/error retry、save/remove/reorder 乐观更新与回滚、folders、import 后刷新。 | 未执行 | 未覆盖 main IPC、preload listener、真实 Electron UI。 |
| E-04 | `src/renderer/src/components/right-sidebar/project-links-tree.test.ts` | 分类嵌套、未分类、空 folder、tree 合并、同分类/跨分类拖拽重排与 index clamp。 | 未执行 | 未覆盖 DnD DOM 交互、跨 scope 拖拽视觉/提示。 |
| E-05 | `src/main/persistence-deregistered-repo-residue.test.ts` | orphan repo sweep、remote runtime session 例外、无 orphan 时不重写 profile。 | 未执行 | 未放入 ProjectLinks maps fixture，因此不能证明 links/folders 清理。 |

## 三、用例矩阵

### 3.1 URL、输入与安全边界

| 案例 ID | 场景/步骤 | 类型 | 预期结果 | 现有证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-VAL-01 | 保存 ` example.com `。 | 单元 | 保存 URL 为 `https://example.com/`。 | E-01 | 未执行 |
| PL-VAL-02 | 保存 `http://internal.test:8080/path`。 | 单元 | 保留 HTTP URL。 | E-01 | 未执行 |
| PL-VAL-03 | 保存空名称、81 字名称、41 字分类、空/超长 URL。 | 单元 | 分别被拒绝，错误可定位。 | E-01 | 未执行 |
| PL-VAL-04 | 保存或导入 `javascript:`、`file:`、`data:`。 | 单元 | 不持久化该链接。 | E-01、E-02 | 未执行 |
| PL-VAL-05 | 直接调用 `shell:openUrl` 传非 HTTP/HTTPS URL。 | IPC/集成 | 不调用 `shell.openExternal`。 | 无 | 待补 |
| PL-VAL-06 | 点击已保存 HTTP/HTTPS 链接。 | 隔离 Electron UI | renderer 仅走 preload；系统默认浏览器打开请求可被 mock 验证。 | 无 | 待补；原生/可见验证仅隔离 CI |

### 3.2 Store 持久化、排序与 scope 隔离

| 案例 ID | 场景/步骤 | 类型 | 预期结果 | 现有证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-PER-01 | 保存 `order=1,Zed` 和 `order=0,Alpha`。 | persistence unit | 读取顺序为 Alpha、Zed；每次变更安排保存。 | 无 | 待补 `project-link-persistence.test.ts` |
| PL-PER-02 | 保存无 `order` 和有 `order` 的链接。 | persistence unit | 缺失 order 在末尾，名称作为稳定次序。 | 间接 E-03 | 待补 direct test |
| PL-PER-03 | 更新相同 ID 的项目链接。 | persistence unit | 原记录替换，不重复插入；保留/更新字段符合 handler 语义。 | 无 | 待补 |
| PL-PER-04 | 新增重复 folder path 两次。 | persistence unit | 只保存一次；第二次不额外 scheduleSave。 | 无 | 待补 |
| PL-PER-05 | 写 global link 与 repo link。 | persistence unit | global `repoId=''`，不修改项目 bucket；两者独立排序。 | 无 | 待补 |
| PL-PER-06 | 删除最后 owner 的 repo 后重载 profile。 | persistence/integration | links/folders 两张项目 map 从磁盘移除；global 保留。 | E-05 未覆盖 | 待补，且当前代码预期失败直到 D1 修复 |
| PL-PER-07 | 删除一个 host owner、但相同 repo ID 在另一 host 仍存在。 | persistence/integration | 不清理项目 links/folders。 | E-05 仅有相近 session 例外 | 待补 |
| PL-PER-08 | 仅 `runtime:*` 远端记录缺席本机 catalog 时启动 sweep。 | persistence/integration | 不以缺席推断项目删除；数据保持。 | E-05 有相近远端 session 例外 | 待补 |

### 3.3 main IPC、preload 与通知

| 案例 ID | 场景/步骤 | 类型 | 预期结果 | 现有证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-IPC-01 | `projectLinks:save` 传未知 repo。 | IPC handler unit | 抛出/返回 repo not found；不调用 Store save 或通知。 | 无 | 待补 `repos-project-links.test.ts` |
| PL-IPC-02 | 项目 save、remove、reorder。 | IPC handler unit | 验证 repo、规范化字段、调用对应 Store、发送 `{repoId}` changed。 | 无 | 待补 |
| PL-IPC-03 | global save/remove/reorder。 | IPC handler unit | 保存 `repoId=''`，发送 globalChanged，不读取项目 repo。 | 无 | 待补 |
| PL-IPC-04 | 手工 add/remove folder。 | IPC handler unit | add 使用 path normalizer；非法路径拒绝；成功通知正确。 | 无 | 待补 |
| PL-IPC-05 | import 选择有效文件、取消、未知 repo、读写/JSON 错误。 | IPC handler unit | 结构化 `ok/cancelled/error` 正确；仅实际插入时通知。 | 无 | 待补 |
| PL-IPC-06 | import 内含过深、超长或含空段 folder path。 | IPC handler unit | 与手工 folder 创建规则一致；按已确认策略跳过或拒绝。 | 无 | 待补；当前实现存在差异 |
| PL-PRE-01 | projectLinks bridge 各方法。 | preload unit | 逐一 invoke 正确 channel 和 args。 | 无 | 待补 `project-links-bridge.test.ts` |
| PL-PRE-02 | `onChanged/onGlobalChanged` 和 folder listeners。 | preload unit | 注册后 callback 收到正确 payload；cleanup 仅移除自己的 listener。 | 无 | 待补 |
| PL-REN-01 | renderer 订阅 main change event。 | slice/UI unit | 已加载对应 bucket 失效并刷新；unmount 后不再更新。 | 无 | 待补；需先明确订阅策略 |

### 3.4 导入导出与合并

| 案例 ID | 场景/步骤 | 类型 | 预期结果 | 现有证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-IMP-01 | 解析合法 version 1 envelope。 | 单元 | URL 正规化；空 folder 丢弃。 | E-02 | 未执行 |
| PL-IMP-02 | kind 错误、非对象、缺 schema、未来 schema。 | 单元 | 整个文件拒绝并说明错误。 | E-02 | 未执行 |
| PL-IMP-03 | 合法与非法 links 混合。 | 单元 | 非法项跳过，有效 sibling 保留。 | E-02 | 未执行 |
| PL-IMP-04 | 已有同 URL+分类、文件内同 URL+分类、同 URL不同分类。 | 单元 | 分别正确计 skipped/duplicatesInFile/新插入。 | E-02 | 未执行 |
| PL-IMP-05 | 导出带 links/folders。 | IPC handler unit | 输出 schema/kind/时间，未输出 ID/时间戳；数量返回准确。 | 无 | 待补 |
| PL-IMP-06 | 导入后保存链接和文件夹并刷新 renderer cache。 | IPC + slice integration | 新 link 重新生成 ID/时间；slice 清 cache 后读取权威数据。 | E-03 仅 refresh 行为 | 待补 |

### 3.5 renderer UI、DND 与跨环境

| 案例 ID | 场景/步骤 | 类型 | 预期结果 | 现有证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-UI-01 | 初次打开 active repo 的 Links 面板。 | 隔离 Electron UI | local/global 懒加载；加载、空态和错误态可区分。 | 代码存在，未测试 | 待补 |
| PL-UI-02 | 新建/编辑/两步删除链接。 | 隔离 Electron UI | 输入限制、scope 切换、成功/失败反馈符合设计。 | 代码存在，未测试 | 待补 |
| PL-UI-03 | 空 folder、分类隐含 folder、未分类 bucket。 | component/Electron UI | 树正确且不重复节点。 | E-04 部分覆盖 | 未执行 |
| PL-UI-04 | 同 scope 和跨 scope 拖拽。 | 隔离 Electron UI | 同 scope 正确 reorder；跨 scope 不移动或复制。 | E-04 逻辑部分覆盖 | 待补 |
| PL-ENV-01 | SSH 项目中操作链接。 | 隔离 CI/integration | 只影响 client profile；不读取/执行远端文件；不把断连当作链接或进程状态。 | 架构规则，未测试 | 待补 |
| PL-ENV-02 | folder workspace。 | 隔离 CI/integration | 使用已确认稳定 owner key；无 key 时行为符合产品决定。 | 无 | 阻塞于 OQ4 |
| PL-ENV-03 | macOS/Linux/Windows。 | CI matrix | CRUD、导入导出、URL guard 行为一致。 | 无 | 待补 |

## 四、建议执行命令与环境限制

以下是**后续主 agent 执行的建议**，本阶段没有运行：

```bash
ORCA_BACKGROUND_LAUNCH=1 pnpm test src/main/ipc/project-link-normalization.test.ts src/main/ipc/project-links-import-merge.test.ts src/renderer/src/store/slices/project-links.test.ts src/renderer/src/components/right-sidebar/project-links-tree.test.ts
ORCA_BACKGROUND_LAUNCH=1 pnpm test src/main/persistence/loading-store/project-link-persistence.test.ts src/main/ipc/repos-project-links.test.ts src/preload/project-links-bridge.test.ts src/main/persistence-deregistered-repo-residue.test.ts
ORCA_BACKGROUND_LAUNCH=1 pnpm tc
ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed
```

- `ORCA_BACKGROUND_LAUNCH=1` 必须用于 agent 启动的测试和应用。
- 可见 UI、原生文件对话框、系统浏览器或 native-focus 场景只能在隔离显示器或 CI 执行；不得抢占用户桌面焦点。
- UI 验证应采用 Electron skill 与 Playwright CDP 的隐藏 renderer 截图/断言；不以人工可见窗口或 computer-use 作为 Orca UI 验证。
- `pnpm run build:mac` 不是本测试阶段的默认替代品；仅在发布候选且依赖齐全时由主 agent 决定执行。

## 五、实际运行结果

### 2026-09-20 文档整理校验

| 命令 | 结果 | 证据与边界 |
| --- | --- | --- |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed` | 通过 | 输出为无变更 JS/TS；该静态检查不执行 ProjectLinks 功能测试，也不证明功能行为正确。 |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm tc` | 未完整通过 | 报 `src/shared/types.ts:76` 导出 `BrowserSessionProfileCreateOptions` 不存在，约 120 秒后超时；不能将本次类型检查记录为通过。 |

```text
本轮既有 ProjectLinks 功能测试执行：无
功能测试通过：无执行证据
覆盖率：未采集
静态检查通过不等于功能测试通过。
```

### 已知预期失败/阻塞

| 项目 | 原因 | 处理 |
| --- | --- | --- |
| PL-PER-06 / AC7 | 当前 repo lifecycle 未删除 project links/folders maps。 | 先修 D1，再运行并记录实际结果。 |
| PL-IPC-06 | 导入 folder 未复用手工 normalizer。 | 先确认并实现 OQ2，再固定测试预期。 |
| PL-ENV-02 | folder workspace stable owner key 未确认。 | 产品/架构决策后再测试。 |
| PL-REN-01 | renderer event 订阅策略尚未证实。 | 明确多窗口一致性目标后补测试。 |

## 六、测试完成判定

本需求要从“未执行”变为“全通过”，至少需要：

1. 高风险 D1、D2 关闭并有对应 direct tests；
2. E-01 至 E-05 和新增 persistence/IPC/preload tests 实际运行并记录命令、测试数、失败数；
3. `pnpm tc` 与 changed-code quality 检查的实际结果；
4. SSH、folder workspace、跨平台及隔离 UI 验证的范围、环境和结论；
5. 没有把无法观察的远端状态、取消文件对话框或未运行测试误报为通过。
