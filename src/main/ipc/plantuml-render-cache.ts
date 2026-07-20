// Why: each render spawns a cold-start JVM (`java -jar plantuml.jar`), which
// dominates render latency. The renderer keeps its own SVG cache, but that is
// per-window; this process-global cache also serves paired web/mobile clients
// over RPC and repeated identical diagrams within one document, so an unchanged
// diagram never re-spawns the JVM here either. Only successful renders are
// cached — errors (missing java, bad jar path, timeout) may be transient or
// user-fixable and must be retried.

type CachedRender = {
  svg: string
  /** UTF-8 byte size of the SVG, used to bound the cache by total bytes. */
  bytes: number
}

const cache = new Map<string, CachedRender>()

// Why: cap entries so a long-lived process browsing many documents can't grow
// the cache unbounded.
export const PLANTUML_RENDER_CACHE_MAX_ENTRIES = 100
// Why: a pathological diagram's SVG can approach the 16MB execFile buffer, so
// entry count alone doesn't bound memory. Cap total cached bytes too; we always
// keep the most-recent entry so a single oversized diagram still stays cached
// rather than re-rendering on every read.
export const PLANTUML_RENDER_CACHE_MAX_BYTES = 64 * 1024 * 1024
// Overridable only from tests so the byte-eviction path can be exercised with a
// tiny budget instead of allocating 64MB of fixtures; production always uses the
// constant above.
let maxCacheBytes = PLANTUML_RENDER_CACHE_MAX_BYTES

export function renderCacheKey(jarPath: string, source: string): string {
  // NUL can't appear in a path or diagram source, so composed keys never collide.
  return `${jarPath}\0${source}`
}

export function getCachedRender(key: string): string | undefined {
  const entry = cache.get(key)
  if (entry === undefined) {
    return undefined
  }
  // Re-insert so this key becomes the most-recent entry for LRU eviction.
  cache.delete(key)
  cache.set(key, entry)
  return entry.svg
}

export function setCachedRender(key: string, svg: string): void {
  cache.delete(key)
  cache.set(key, { svg, bytes: Buffer.byteLength(svg, 'utf8') })
  let totalBytes = 0
  for (const entry of cache.values()) {
    totalBytes += entry.bytes
  }
  // Evict oldest until within BOTH caps, but never drop the most-recent entry
  // (size > 1): a single diagram larger than the whole budget must stay cached
  // or it would re-render every time.
  while (
    cache.size > 1 &&
    (cache.size > PLANTUML_RENDER_CACHE_MAX_ENTRIES || totalBytes > maxCacheBytes)
  ) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) {
      break
    }
    totalBytes -= cache.get(oldest)?.bytes ?? 0
    cache.delete(oldest)
  }
}

/** Test-only: drop the render cache between runs. */
export function clearPlantumlRenderCacheForTests(): void {
  cache.clear()
}

/** Test-only: current entry count, for asserting eviction. */
export function plantumlRenderCacheSizeForTests(): number {
  return cache.size
}

/** Test-only: override the byte budget (pass no arg to restore the default). */
export function setPlantumlRenderCacheMaxBytesForTests(bytes?: number): void {
  maxCacheBytes = bytes ?? PLANTUML_RENDER_CACHE_MAX_BYTES
}
