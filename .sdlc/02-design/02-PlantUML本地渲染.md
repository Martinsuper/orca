> 需求名称：PlantUML本地渲染
> 需求编号：02
> 日期：2026-09-20
> 状态：待评审（既有实现逆向整理，未执行正式评审）
> 关联：[PRD](../01-prd/02-PlantUML本地渲染.md) ｜ [设计](../02-design/02-PlantUML本地渲染.md) ｜ [评审记录](../03-review/02-PlantUML本地渲染.md) ｜ [实现说明](../04-code/02-PlantUML本地渲染.md) ｜ [测试计划](../05-test/02-PlantUML本地渲染.md) ｜ [发布清单](../06-deploy/02-PlantUML本地渲染.md) ｜ [原始说明](../../docs/reference/local-plantuml-rendering.md)
> 项目画像：Electron + React + TypeScript 桌面应用 ｜ 启用章节：renderer、Electron IPC、本地子进程、SVG 安全、跨平台、SSH/Web 边界

# 1. 设计目标与约束

本文件描述仓库中已存在的 PlantUML 本地渲染链路，而非本次待开发方案。图文能力定位为桌面客户端的 UI 渲染：用户选定本地 JAR，Electron 主进程调用本机 `java`，将 SVG 回送渲染器。

- 不调用 Orca 自建或公开的外部 PlantUML 渲染 API。
- `java.awt.headless=true` 必须在 `-jar` 前，避免 macOS 每次渲染出现 Java GUI/Dock 行为。
- Java 是本地辅助渲染进程，不应被表述为 JVM 后端服务；无数据库、MQ、HTTP 业务接口或服务端部署单元。
- 不生成图文件：源码经 stdin 进入 Java，SVG 从 stdout 返回。
- 设计没有实现强制安全 profile、网络禁用或本地资源禁用；不得将“本地渲染”解释为“沙箱”。

# 2. 模块与职责

| 模块 | 职责 | 现状 | 关键文件 |
| --- | --- | --- | --- |
| 设置模型与编辑器设置项 | 保存可选 JAR 路径，供用户浏览、显示与清空 | 已实现 | `src/shared/global-settings-types.ts:101`；`src/renderer/src/components/settings/PlantumlJarPathSetting.tsx:14` |
| 原生选择器 | 选择本机文件，UI 过滤 `.jar` | 已实现 | `src/main/ipc/shell.ts:169`；`src/preload/api/shell-bridge.ts:42` |
| 普通 Markdown 预览 | 将 `language-plantuml` code 替换为图块并解包 `pre` | 已实现 | `src/renderer/src/components/editor/use-markdown-preview-components.tsx:157` |
| 评论 Markdown | 识别/解包 PlantUML fence，复用图块 | 已实现 | `src/renderer/src/components/sidebar/comment-plantuml-fence.tsx:7`；`comment-markdown-element-renderers.tsx:270` |
| 富 Markdown 编辑器 | 显示图预览并控制源码折叠/展开 | 已实现 | `src/renderer/src/components/editor/RichMarkdownCodeBlock.tsx:37` |
| 图块 | 调 IPC、两层之一的 renderer 缓存、SVG 净化/比例/画布、错误回退 | 已实现 | `src/renderer/src/components/editor/PlantUmlBlock.tsx:29` |
| preload 合约 | 将 renderer 限制在 `plantuml.render` 窄接口 | 已实现 | `src/preload/api-types.ts:93`；`src/preload/api/plantuml-bridge.ts:4` |
| 主进程渲染服务 | 校验可读 JAR、启动 Java、处理输出、超时和主缓存 | 已实现 | `src/main/ipc/plantuml.ts:26`；`plantuml-render-cache.ts:15` |
| IPC 注册 | 将 `plantuml:render` 注册到核心 handler | 已实现 | `src/main/ipc/register-core-handlers/register-core-handlers.ts:162` |

# 3. 数据模型与接口契约

| 对象/接口 | 字段或形态 | 语义与约束 |
| --- | --- | --- |
| `GlobalSettings.plantumlJarPath` | `string?` | 未设置/空字符串表示禁用；路径是用户本机路径 |
| `PlantumlRenderArgs` | `source: string`、`jarPath: string` | renderer 经 IPC 传入；当前没有 runtime schema、来源 host 或权限上下文 |
| `PlantumlRenderResult` | 成功 `{ svg }` 或失败 `{ error }` | 调用方始终按结构化结果回退，不应抛出破坏预览的异常 |
| IPC channel | `plantuml:render` | preload 使用 `ipcRenderer.invoke`，主进程以 `ipcMain.handle` 提供 |
| 主缓存键 | `jarPath + NUL + source` | 同路径、同源码才共享；避免不同 JAR/源码碰撞 |
| renderer 缓存键 | `jarPath + NUL + content` | 模块级，跨组件卸载生存 |

# 4. 核心流程（文本链路）

## 4.1 普通预览和评论

```text
Markdown fenced code（language-plantuml）
  -> 普通预览：useMarkdownPreviewComponents.code / pre 解包
  -> 评论：isPlantumlFence / isPlantumlPre 解包
  -> PlantUmlBlock(content)
  -> renderer LRU 命中？命中则显示；未命中继续
  -> window.api.plantuml.render({ source, jarPath })
  -> preload plantumlApi -> IPC plantuml:render
  -> main renderPlantuml
  -> java -Djava.awt.headless=true -jar <jar> -tsvg -pipe -charset UTF-8
  -> stdout SVG -> main LRU -> renderer DOMPurify/比例处理 -> SVG DOM
```

普通预览与评论必须解开 `pre`：`PlantUmlBlock` 最终是 `div`，嵌在 `pre` 中会形成无效 HTML。评论路径使用同一图组件，因此配置、缓存和错误表现应保持一致。

## 4.2 富 Markdown 编辑器

```text
RichMarkdownCodeBlock(language=plantuml, source 非空)
  -> 显示非 contentEditable 的 .plantuml-preview
  -> PlantUmlBlock(source.trim())
  -> 初始 sourceExpanded=false，隐藏 pre/select/copy
  -> 点击、Enter 或 Space 切换 sourceExpanded
  -> 编辑源码仍由既有 NodeViewContent 保持
```

该路径的设计目标是“图优先、源码可恢复编辑”，不是仅显示图片。空源码不建立预览。

# 5. 本地渲染服务细节

## 5.1 Java 调用、输出与错误

| 环节 | 既有行为 | 用户可见/系统后果 |
| --- | --- | --- |
| JAR 路径 | trim 后为空即返回“未配置”；否则仅 `R_OK` 检查 | UI picker 的 `.jar` 过滤不等于主进程验证扩展名、签名或版本 |
| 调用 | `execFile('java', ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', '-pipe', '-charset', 'UTF-8'])` | shell 不参与参数拼接；Java 从 PATH 解析 |
| 输入输出 | `endSubprocessStdin` 写源码；读取 stdout/stderr | Orca 不落地输入/输出图临时文件 |
| 成功判定 | stdout 包含 `<svg` 即成功 | 非零退出但仍有 PlantUML 语法错误 SVG 时优先呈现该图 |
| 无 Java | `ENOENT` 映射为“Java runtime not found” | 提示安装/配置 Java，而非崩溃 |
| 超时 | 20,000 ms 后 `child.kill()` 并返回超时错误 | 当前没有用户级取消和进程组清理保证 |
| 缓冲 | `maxBuffer = 16 MiB` | 大图输出受限；超限应走错误回退 |

## 5.2 缓存策略

| 层级 | 上限 | 目的 | 失效/保留规则 |
| --- | --- | --- | --- |
| renderer `Map` | 100 项，无独立总字节上限 | 页面回访/组件重挂载不闪 loading、不再 IPC | LRU；键包含 JAR 路径与源码 |
| main `Map` | 100 项、64 MiB 总 SVG 字节数 | 不同窗口/重复图避免冷启动 JVM | LRU；只缓存成功；单个过大最新项仍保留 |

缓存不跨应用重启持久化；更换 JAR 路径天然换键。缓存不保存错误，避免用户修复 Java/JAR 后被旧错误阻断。

# 6. SVG 呈现、安全与比例

1. 主进程只返回原始 SVG 文本；渲染器以 `DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true } })` 净化后才调用 `dangerouslySetInnerHTML`。
2. `normalizeDiagramSvg` 删除输出 SVG 的 `style`，有效 `viewBox` 改为 `preserveAspectRatio="xMidYMid meet"`；无效 viewBox 去掉原比例属性，防止 `none` 拉伸。
3. 完成挂载后以 `getBBox()` 收紧 viewBox，并在四周加 12px；测量失败保留原 SVG。
4. CSS 使图按内容居中、`max-width: 100%`、超宽横向滚动，并保留 PlantUML 黑线/文字的白底；富编辑器预览遵循现有 focus-visible `--ring`。
5. SVG DOM 净化是浏览器注入防护。它不约束已运行的 Java/JAR 对文件、URL、include 或环境变量的访问。

# 7. 本地、SSH 和 Web 边界

| 情形 | 已证实行为 | 不可推导的结论 |
| --- | --- | --- |
| 桌面本地 Markdown | Electron 主进程运行用户本机 Java/JAR | 不代表 JAR 已受信任或被隔离 |
| SSH/远端工作区 Markdown | 文本抵达本地 renderer 后，当前 API 不携带 `executionHostId`，Java 调用走客户端 Electron 主进程 | 不应称其为在 SSH 执行主机运行；也不能因为文件远端就宣称无本机风险 |
| Web preload 环境 | `createWebPreloadApi` 未提供 `plantuml` 域 | 不承诺 Web 可用或会远端渲染 |
| 外部 API | Orca 未调用外部 PlantUML 渲染 API | 不等价于 Java/JAR、`!include` 或 URL 资源不会联网 |

SSH 总原则是执行主机拥有执行；这里要由评审明确接受“客户端 UI 对已经接收的文档文本进行本地渲染”的例外/边界，或改为显式拒绝远端来源、改走远端受控执行、或施加本地沙箱。当前代码未做这项判断。

# 8. 安全取舍与遗留

| # | 类型 | 描述 | 影响 | 现有缓解/待决策 |
| --- | --- | --- | --- | --- |
| 1 | 风险 | 主进程只检查 JAR 可读，用户/恶意 renderer IPC 可指向任意可读 JAR | 本地代码执行信任边界 | 需决定可信来源、签名/版本校验或权限模型 |
| 2 | 风险 | 未显式设置 PlantUML security profile 或 URL/路径 allowlist | JAR 与环境决定 include/URL/本地资源行为 | 不能对外承诺禁网；需安全专项决策 |
| 3 | 权衡 | 本地 JAR 避免将源码交给 Orca 外部渲染 API | 隐私更好，但将依赖可信 JAR/本机 Java | 保留用户自选灵活性，牺牲版本一致性 |
| 4 | 遗留 | 未限制并发、无请求取消；超时仅 kill 当前 child | 资源消耗与异常进程处理 | 后续补并发队列、取消和进程组策略 |
| 5 | 遗留 | stderr/异常直接面向用户显示 | 可能含本机路径或 Java 细节 | 后续评估错误脱敏与诊断分层 |
| 6 | 遗留 | renderer 缓存无字节预算 | 多个大 SVG 可增加 renderer 内存 | 后续加入字节上限或观测 |

# 9. 引用梳理与验收回链

| 类型 | 发现 |
| --- | --- |
| 设置入口 | `PlantumlJarPathSetting` 是路径选择/清空入口；设置类型是全局设置的一部分 |
| Markdown 入口 | 普通预览、评论、富 Markdown 编辑器三条入口复用 `PlantUmlBlock` |
| IPC 入口 | preload `plantumlApi` -> `plantuml:render` -> `registerPlantumlHandlers` |
| 视觉依赖 | `markdown-preview.css`、`rich-markdown-editor.css`，使用现有 token/焦点环约定 |
| 测试引用 | renderer 行为、主缓存、核心 handler 注册已有覆盖；实际 Java 和安全边界尚无覆盖 |

| PRD 验收 | 承接章节/机制 | 当前设计覆盖 |
| --- | --- | --- |
| AC1、AC3 | 4.1 Markdown/评论文本链路 | 完全 |
| AC2 | 4.2 富编辑器 | 完全 |
| AC4 | 5.1 错误分支 | 完全（真实执行尚未复验） |
| AC5 | 5.2 缓存策略 | 完全（缓存单测存在） |
| AC6 | 6 SVG 净化 | 部分：有净化机制，无恶意 SVG 实测证据 |
| AC7 | 7 边界 | 部分：代码边界已记录，安全/产品决策未完成 |
