> 需求名称：PlantUML本地渲染
> 需求编号：02
> 日期：2026-09-20
> 状态：功能测试未执行（已记录文档整理静态检查）
> 关联：[PRD](../01-prd/02-PlantUML本地渲染.md) ｜ [设计](../02-design/02-PlantUML本地渲染.md) ｜ [评审记录](../03-review/02-PlantUML本地渲染.md) ｜ [实现说明](../04-code/02-PlantUML本地渲染.md) ｜ [测试计划](../05-test/02-PlantUML本地渲染.md) ｜ [发布清单](../06-deploy/02-PlantUML本地渲染.md)

# 1. 测试状态声明

本文件不是功能测试报告。已确认仓库中存在下列单测文件和 package scripts；既有功能测试、lint、format、安装、构建和应用启动本轮均未执行。通过数、失败数、跳过数和覆盖率均为“未采集”，不得填写为零或通过。

## 1.1 2026-09-20 文档整理校验

| 命令 | 结果 | 结论 |
| --- | --- | --- |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed` | 通过；输出为无变更 JS/TS | 仅说明本轮文档整理没有需检查的 JS/TS 改动，不是功能测试 |
| `ORCA_BACKGROUND_LAUNCH=1 pnpm tc` | 在 120 秒后超时；此前报 `src/shared/types.ts:76` 导出 `BrowserSessionProfileCreateOptions` 不存在 | 没有完整通过结果；不得据此声称类型检查通过或失败原因已归属于本需求 |

静态检查不等于功能测试，也不替代正式评审、安全验证或发布验证。既有 PlantUML 功能测试本轮未执行。

所有会启动 Electron 或可见 UI 的验证应遵守仓库约束：使用 `ORCA_BACKGROUND_LAUNCH=1`，可见/原生焦点测试仅在隔离显示器或 CI 运行；本需求当前不执行这些操作。

# 2. 已有测试资产

| 文件 | 已覆盖事实 | 未覆盖事实 |
| --- | --- | --- |
| `src/renderer/src/components/editor/PlantUmlBlock.test.ts:5` | SVG style 删除、有效/无效 viewBox 的比例处理、`getBBox` 画布收紧/失败保留原画布 | IPC 调用、DOMPurify 实际净化、错误 UI、真实 JAR |
| `src/renderer/src/components/editor/RichMarkdownCodeBlock.plantuml.test.tsx:32` | 富编辑器创建预览、默认折叠源码、点击与 Enter 展开/收起 | Java 渲染、Space 键、真实 DOMPurify、可见 UI |
| `src/renderer/src/components/editor/use-markdown-preview-components.plantuml.test.tsx:48` | 普通预览识别 PlantUML 并避免 `<pre>` 包裹 | 评论入口、真实渲染、配置/错误分支 |
| `src/main/ipc/plantuml-render-cache.test.ts:14` | 缓存命中、键隔离、LRU 项数淘汰、字节淘汰、超大单项保留 | render service 与缓存的端到端组合 |
| `src/main/ipc/register-core-handlers/register-core-handlers.test.ts:542` | 核心 handler 装配会调用 `registerPlantumlHandlers` | channel 调用、Java argv、错误/timeout |

当前未发现独立的 PlantUML preload bridge 测试、评论 PlantUML 围栏测试、真实 JAR 子进程测试、恶意 SVG 净化测试、SSH 来源文档测试或 Web 不支持行为测试。

# 3. 前置条件与隔离原则

| 前置项 | 要求 | 状态 |
| --- | --- | --- |
| 依赖安装 | 使用现有 lockfile 与仓库依赖；不得在本计划执行时安装 | 未执行 |
| Node/Electron runtime | 使用仓库脚本自动保证的 runtime | 未执行 |
| Java/JAR 集成夹具 | 受控、明确版本、可审计的 JRE/JDK 与测试 JAR；不得使用未知用户 JAR | 待提供 |
| 安全环境 | 若测试 include/URL，使用隔离网络、临时目录和可观察请求端点 | 待设计 |
| UI 环境 | `ORCA_BACKGROUND_LAUNCH=1`；原生可见窗口测试限隔离 CI/显示器 | 未执行 |
| SSH/Web 环境 | 明确客户端、远端工作区与 Web runtime 的测试矩阵 | 待设计 |

# 4. 用例矩阵

| ID | 场景与前置步骤 | 类型 | 预期结果 | 当前结果 |
| --- | --- | --- | --- | --- |
| T-01 | 运行 `PlantUmlBlock.test.ts` 的比例/画布用例 | 单元 | 有效 viewBox 使用均匀比例；无效 viewBox 不保留错误比例；测量失败不改原画布 | 未执行 |
| T-02 | 运行富编辑器 PlantUML preview 用例 | 单元 | 非空 `plantuml` 块显示预览；初始折叠；点击/Enter 切换源码 | 未执行 |
| T-03 | 运行普通 Markdown preview fence 用例 | 单元 | `language-plantuml` 渲染图组件且最终不存在 `pre` 包裹 | 未执行 |
| T-04 | 运行主缓存用例 | 单元 | 键按 JAR+源码隔离；LRU 满后淘汰最旧；按字节限制淘汰；错误不在该层模拟 | 未执行 |
| T-05 | 运行核心 handler 注册用例 | 单元 | 启动装配调用 `registerPlantumlHandlers` | 未执行 |
| T-06 | 设置空 JAR 路径，打开 PlantUML 围栏 | 集成 | 不启动 Java；显示未配置错误与原源码 | 未执行 |
| T-07 | 设置不可读/不存在 JAR | 集成 | 显示“jar not found or unreadable”；原源码保持可见 | 未执行 |
| T-08 | 受控环境下从 PATH 移除 Java | 集成 | 显示 Java runtime not found；应用其它 Markdown 不受影响 | 未执行 |
| T-09 | 使用受控有效 JAR 和有效源码 | 集成 | stdout SVG 经过净化/比例处理并显示；不写 Orca 输入/输出临时图文件 | 未执行 |
| T-10 | 使用受控 JAR 和语法错误源码 | 集成 | 若 stdout 含 PlantUML 错误 SVG，优先显示该 SVG；否则显示错误与源码 | 未执行 |
| T-11 | 让受控 JAR 超过 20 秒无输出 | 集成 | 20 秒后错误回退；检查 child 终止行为并记录遗留进程风险 | 未执行 |
| T-12 | 输出超过 16 MiB 或触发 buffer 错误 | 集成 | 不耗尽进程内存；回退错误可读 | 未执行 |
| T-13 | 同 JAR/源码连续渲染、重挂载、换 JAR | 集成 | 成功命中对应 LRU；换 JAR 不复用旧 SVG；错误修复后可重试 | 未执行 |
| T-14 | 受控 JAR 输出带事件属性、脚本或危险 SVG 片段 | 安全单元/集成 | DOMPurify 后插入 DOM 的结果不含被禁止标记；不把此结果解释为 JAR 沙箱 | 未执行 |
| T-15 | 评论 Markdown 围栏 | UI/集成 | 评论端识别、解开 `pre`，并与普通预览使用同一图块/错误回退 | 未执行 |
| T-16 | 富编辑器 Space 键、焦点环、空源码 | UI 单元/隔离 UI | Space 与 Enter 一致切换；焦点可见；空源码不显示预览 | 未执行 |
| T-17 | SSH 来源的 Markdown 已进入客户端 renderer | 集成/架构验证 | 记录 Java 在客户端 Electron 主进程运行，而非无证据地宣称远端执行 | 未执行 |
| T-18 | Web preload 环境渲染 PlantUML | Web 兼容 | 明确当前无 `plantuml` API 的实际表现；不得将桌面能力当作 Web 支持 | 未执行 |
| T-19 | 受控 profile、`!include` 与 URL 资源矩阵 | 安全集成 | 分别证明所选 JAR/环境的实际行为；结果作为安全决策证据，不预设禁网 | 未执行 |
| T-20 | macOS/Linux/Windows 的 Java PATH 和 JAR 路径 | 跨平台集成 | 每个平台的成功、缺 Java、不可读 JAR 提示与 headless 行为符合预期 | 未执行 |

# 5. 建议命令（仅记录，未执行）

```bash
ORCA_BACKGROUND_LAUNCH=1 pnpm run test:local-features
ORCA_BACKGROUND_LAUNCH=1 pnpm test src/main/ipc/plantuml-render-cache.test.ts
ORCA_BACKGROUND_LAUNCH=1 pnpm test src/renderer/src/components/editor/PlantUmlBlock.test.ts src/renderer/src/components/editor/RichMarkdownCodeBlock.plantuml.test.tsx src/renderer/src/components/editor/use-markdown-preview-components.plantuml.test.tsx src/main/ipc/register-core-handlers/register-core-handlers.test.ts
ORCA_BACKGROUND_LAUNCH=1 pnpm tc
ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed
```

- `pnpm run test:local-features` 当前覆盖核心 handler 注册、`PlantUmlBlock`、普通预览和富编辑器路径，但不覆盖主缓存测试。
- 上述命令是后续主 agent/CI 的建议，不表示本次已执行。若实际新增/修改代码，再按仓库要求补充 lint/typecheck；本次没有代码改动。
- 任何需要启动 Electron 的真实 UI 验证，都应后台启动；不得抢占用户桌面、显示窗口或依赖可见窗口断言。

# 6. 覆盖目标与当前证据

| 目标 | 目标说明 | 当前实际 |
| --- | --- | --- |
| 既有单元测试 | 现有 renderer/缓存/注册测试可运行且通过 | 未执行，未知 |
| 入口回归 | 普通预览、评论、富编辑器三入口 | 普通/富编辑器有测试资产；评论未覆盖；结果未知 |
| 真实子进程 | 有效 JAR、错误 JAR、无 Java、超时/大输出 | 无现有执行证据 |
| 安全 | SVG 净化及 JAR/profile/include 资源边界 | 无现有执行证据 |
| SSH/Web | 客户端本地边界和 Web 不支持边界 | 无现有执行证据 |
| 覆盖率 | 仅在项目既有覆盖率管线产出后记录 | 未采集 |

# 7. 缺口、失败处理与测试结果格式

## 当前缺口

1. 没有可信、固定版本 JAR 的集成夹具，不能以任意用户 JAR 作为可重复测试依据。
2. 没有对 20 秒 timeout 后子进程/子进程组是否真正退出的证据。
3. 没有 DOMPurify 负向安全夹具，也没有对 SVG 外部资源行为的测试。
4. 没有包含 `!include`/URL 的受控安全矩阵；不能假定其“应当失败”或“应当离线”。
5. 没有评论入口、SSH 来源和 Web 环境的自动化覆盖。
6. 没有跨平台 Java/JAR 行为验证。

## 功能测试实际运行结果（待填）

```text
功能测试命令：未执行
通过：未采集 ｜ 失败：未采集 ｜ 跳过：未采集
覆盖率：未采集
```

本轮静态检查结果见“1.1 2026-09-20 文档整理校验”；其中 code-quality 检查通过，`pnpm tc` 未获得完整通过结果。

若后续任一用例失败，必须记录失败用例 ID、完整但脱敏的运行环境、原因（测试夹具/代码缺陷/环境依赖/预期策略未决）和处理决定；禁止为使报告“全绿”而删除或弱化断言。
