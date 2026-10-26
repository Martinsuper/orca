# Communication preferences

- Writes and expects replies in Chinese. Confidence: 0.95
- Asks "为什么…" / "原因是什么" often — wants the root cause explained, not just a patch applied. Confidence: 0.9
- When asking how to improve something, wants a detailed written 方案/plan (steps, trade-offs) before any code is changed. Confidence: 0.85
- Uses very short confirmations ("OK", "继续", "试试吧", "一个提交") — expects autonomous execution afterwards, not repeated check-ins. Confidence: 0.85
- Prefers the agent to run long-running builds in the background and then report the result/status instead of blocking. Confidence: 0.8
- Framing of requests is imperative and task-scoped; keep responses action-oriented with concrete commands and file paths. Confidence: 0.8
- Asks short capability questions in the form "是否支持…"; wants the verdict stated up front (支持/不支持 + the feature's name), then concrete config paths, field names, and ready-to-paste examples, with pitfalls called out. Confidence: 0.65
