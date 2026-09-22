> 需求名称：PlantUML本地渲染
> 需求编号：02
> 日期：2026-09-20
> 状态：已实现（既有能力说明；本次未开发、未修改业务代码）
> 关联：[PRD](../01-prd/02-PlantUML本地渲染.md) ｜ [设计](../02-design/02-PlantUML本地渲染.md) ｜ [评审记录](../03-review/02-PlantUML本地渲染.md) ｜ [实现说明](../04-code/02-PlantUML本地渲染.md) ｜ [测试计划](../05-test/02-PlantUML本地渲染.md) ｜ [发布清单](../06-deploy/02-PlantUML本地渲染.md)

# 1. 实现状态声明

本文件记录当前工作区已存在的 PlantUML 本地渲染实现，供后续维护、评审和测试交接。此次仅新增 SDLC 文档，**没有**新建/修改 PlantUML 业务源码、没有执行测试、没有发布，也不能以“已实现”推导“本次评审通过”或“本次测试通过”。

# 2. 实现覆盖矩阵

| PRD 能力 | 当前实现状态 | 主要实现位置 | 备注 |
| --- | --- | --- | --- |
| R1 三条 Markdown 入口 | 已实现 | 普通预览、评论、富 Markdown 编辑器 | 都复用 `PlantUmlBlock` |
| R2 JAR 设置/选择/清空 | 已实现 | 全局设置、设置组件、`shell:pickJarFile` | 主进程只检查可读性 |
| R3 preload/IPC/Java 本地渲染 | 已实现 | preload bridge、核心 handler、`plantuml.ts` | `execFile` 不走 shell |
| R4 错误回退 | 已实现 | `PlantUmlBlock`、`renderPlantuml` | 原始源码保留在 error UI |
| R5 双层成功缓存 | 已实现 | renderer Map、main LRU cache | 错误不缓存 |
| R6 SVG 净化和比例修正 | 已实现 | `PlantUmlBlock`、Markdown CSS | 不解决 JAR 进程资源访问 |
| 安全 profile/可信 JAR/SSH 策略 | 未实现/未定夺 | 无 | 见待评审 P0 风险 |
| Web 运行支持 | 未实现 | Web preload 未暴露 `plantuml` | 不应承诺支持 |

# 3. 源码证据索引

| 区域 | 相对路径:行号 | 当前职责 |
| --- | --- | --- |
| 渲染参数/结果类型 | `src/shared/types.ts:60` | `source`、`jarPath` 与 SVG/错误联合结果 |
| 全局设置类型 | `src/shared/global-settings-types.ts:101` | 可选 `plantumlJarPath`；空值禁用 |
| 设置 UI | `src/renderer/src/components/settings/PlantumlJarPathSetting.tsx:14` | 读路径、调用 native picker、清空配置、用户提示 |
| JAR 原生 picker | `src/main/ipc/shell.ts:169` | 选择文件并按 `.jar` 过滤 |
| 普通 Markdown 入口 | `src/renderer/src/components/editor/use-markdown-preview-components.tsx:157` | 识别 `language-plantuml`，图块不进入 `pre` |
| 评论入口 | `src/renderer/src/components/sidebar/comment-plantuml-fence.tsx:7` | 识别 fence、渲染图块、解包 `pre` |
| 富编辑器入口 | `src/renderer/src/components/editor/RichMarkdownCodeBlock.tsx:37` | PlantUML 图预览、源码折叠与键盘展开 |
| 图渲染与 SVG 防线 | `src/renderer/src/components/editor/PlantUmlBlock.tsx:29` | renderer 缓存、IPC、DOMPurify、比例/画布与错误 UI |
| 主缓存 | `src/main/ipc/plantuml-render-cache.ts:15` | 100 项/64 MiB 的 LRU 成功 SVG 缓存 |
| Java 服务 | `src/main/ipc/plantuml.ts:26` | 可读 JAR 检查、Java argv、20 秒 timeout、16 MiB buffer、stdin/stdout |
| IPC 注册 | `src/main/ipc/plantuml.ts:118` | `plantuml:render` handler |
| 核心装配 | `src/main/ipc/register-core-handlers/register-core-handlers.ts:162` | 应用启动时注册 PlantUML handler |
| preload 类型与实现 | `src/preload/api-types.ts:93`、`src/preload/api/plantuml-bridge.ts:4` | renderer 的窄 API |
| preload 暴露 | `src/preload/index.ts:124` | `window.api.plantuml` |
| 预览样式 | `src/renderer/src/assets/markdown-preview.css:719` | SVG 容器、比例、滚动、白底、错误样式 |
| 编辑器样式 | `src/renderer/src/assets/rich-markdown-editor.css:996` | 预览布局、焦点环、源码折叠 |

# 4. 当前关键实现行为

## 4.1 主进程调用

- 参数顺序为 `java`、`-Djava.awt.headless=true`、`-jar`、用户 JAR 路径、`-tsvg`、`-pipe`、`-charset UTF-8`。
- `-pipe` 表示源码写入 stdin、结果从 stdout 读取；它不代表 PlantUML 禁止 include、URL 或本地资源解析。
- stdout 中含 `<svg` 时即缓存并返回，即使 Java 返回非零；此策略让 PlantUML 自带的语法错误 SVG（含行提示）优先显示。
- 超时固定 20 秒、输出缓冲上限 16 MiB；错误由结构化结果返回而非向 renderer 抛出。

## 4.2 缓存和呈现

- renderer 缓存为 100 项 module-level LRU，避免组件重挂载再次 loading/IPC。
- main 缓存为进程级 LRU，100 项且默认 64 MiB；单项过大时仍保留最近项，避免反复冷启动 JVM。
- 只有成功 SVG 进入缓存；配置、Java、JAR、timeout 等错误可以在修复后重试。
- 成功 SVG 在 renderer 端先经过 DOMPurify SVG profile；随后删除 `style`、修正合法 viewBox 的比例、挂载后按 `getBBox` 收紧画布。

# 5. 历史实现来源

| 提交 | 日期 | 历史状态/内容 |
| --- | --- | --- |
| `77000317fa` | 2026-07-15 | 初始本地 JAR、设置、IPC、普通预览/评论/富编辑器与基本样式 |
| `3e1c4e247f` | 2026-07-20 | 增加 renderer/main 双层 SVG LRU 与主缓存单测 |
| `75c774bb1d` | 2026-08-29 | 修复核心 IPC 注册、图比例与画布测试 |
| `8026f097c2` | 2026-09-04 | 增加富 Markdown 编辑器 PlantUML 预览和测试 |
| `56c1727904` | 2026-09-09 | 调整图预览和源码折叠位置/交互 |

历史计划 `docs/superpowers/plans/2026-09-07-restore-project-link-persistence.md` 将 PlantUML preload contract 的恢复置于 ProjectLinks 合并恢复背景中，并列出 PlantUML 测试 fixture 适配。该计划是历史材料，不应被当作本需求已完成的发布或验证记录。

# 6. 与设计的偏差、遗留与注意事项

| 项目 | 现状 | 交接要求 |
| --- | --- | --- |
| PlantUML 安全 profile | 未在 argv 或受控 env 中设置 | 不得宣称 JAR 禁网/禁文件；先完成评审决策 |
| include/资源访问 | Orca 未做拦截或 allowlist | 取决于实际 JAR 和运行环境，须以受控版本验证 |
| JAR 可信性 | 只做 `R_OK` 检查，UI 文件筛选不是安全校验 | 需明确用户自带可信 JAR 的责任边界 |
| 远端文档 | 无 execution-host 参数；在客户端 Electron 主进程渲染 | 必须与 SSH 执行边界决策一并审查 |
| Web | Web preload 中没有 `plantuml` API | 不提供/不承诺 Web 可用性 |
| 进程控制 | 无并发队列/取消；timeout 仅 kill child | 后续改造前先评估资源与子进程行为 |
| 错误展示 | stderr/错误文本可能直接显示 | 评审是否需要脱敏 |

# 7. 本次文档整理变更

| 类型 | 范围 | 结果 |
| --- | --- | --- |
| SDLC 文档 | `.sdlc/01-prd` 至 `.sdlc/06-deploy` 的 `02-PlantUML本地渲染.md` | 本次创建/整理 |
| 业务代码 | `src/**` | 未修改 |
| 配置/JAR/Java 环境 | 用户机器与应用设置 | 未修改 |
| 测试、构建、启动 | 任意命令 | 未执行 |
