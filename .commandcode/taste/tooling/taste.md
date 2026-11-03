# Tooling preferences

- Electron desktop app targeting macOS; ships arm64 (Apple Silicon) DMG + ZIP packages built with electron-builder. Confidence: 0.9
- pnpm as the package manager, with lockfile-frozen installs after merges (not floating installs). Confidence: 0.85
- Works on a markdown preview with PlantUML rendering; expects diagrams shown as rendered images, click-to-expand source, and images scaled to fit the page. Confidence: 0.85
- Diagrams should keep the original plain white canvas (no automatic dark-theme recoloring) and stay proportionally scaled. Confidence: 0.85
- Tests rendering against real project documents kept under `.sdlc/02-design/*.md`. Confidence: 0.8
- Uses Ollama for local models; likes listing installed models and clearing them when disk space is needed. Confidence: 0.75
- Explores a plugin/skill system (orca-cli skill, plugin marketplace) and asks about integrating third-party harnesses such as DeepSeek; also probes whether Command Code can configure third-party API models/providers (BYOK, custom baseURL, OpenAI-compatible or Anthropic-style endpoints). Confidence: 0.8
- Uses git remotes named upstream/main plus a feature branch; wants pushes to the remote branch, not just local commits. Confidence: 0.8
- Runs several AI CLIs side by side (opencode config at `~/.config/opencode/opencode.json`, Command Code at `~/.commandcode/providers.json`) and wants provider/model lists carried over between them instead of re-entered by hand. Confidence: 0.8
- Daily drivers are self-hosted OpenAI-compatible gateways: provider id `cpa` (display name OMLX) reached over Tailscale, and an internal `jd` provider at `http://llm-gw.jd.local/v1`. Confidence: 0.8
- Invokes the Command Code CLI as `cmd`, using `cmd --list-models` and headless `cmd -p "..." -m provider/model` runs to verify config. Confidence: 0.8
- Runs the vitest suite with NODE_ENV=test (the default shell env has NODE_ENV=production and React's production build does not export `act`) and with the repo-pinned bun 1.4.3 from node_modules instead of the stale system bun 1.3.14 on PATH. Confidence: 0.9
- Local `pnpm build:mac` now needs its full prerequisite chain: `cd mobile && pnpm install --frozen-lockfile` (mobile/ is a separate pnpm project), `pnpm install:release` for x64+arm64 native-dependency variants, and `pnpm build:orcad-template --targets darwin-arm64` before packaging; run the build with `ORCA_LOCAL_ORCAD_TARGETS=darwin-arm64` so the packaged-orcad-template verification accepts a partial target set (full 8-target templates are CI-only). Confidence: 0.8
- Prefers API keys to live in exactly one place and be referenced from other tools' configs (e.g. a `!command` reference that reads the key out of the opencode config) rather than duplicated as plaintext. Confidence: 0.75
