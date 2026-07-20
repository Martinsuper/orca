import { beforeEach, describe, expect, it } from 'vitest'
import {
  PLANTUML_RENDER_CACHE_MAX_ENTRIES,
  clearPlantumlRenderCacheForTests,
  getCachedRender,
  plantumlRenderCacheSizeForTests,
  renderCacheKey,
  setCachedRender,
  setPlantumlRenderCacheMaxBytesForTests
} from './plantuml-render-cache'

const JAR = '/opt/plantuml.jar'

describe('plantuml render cache', () => {
  beforeEach(() => {
    clearPlantumlRenderCacheForTests()
    setPlantumlRenderCacheMaxBytesForTests()
  })

  it('returns undefined on a miss and the stored svg on a hit', () => {
    const key = renderCacheKey(JAR, '@startuml\nA->B\n@enduml')
    expect(getCachedRender(key)).toBeUndefined()
    setCachedRender(key, '<svg>diagram</svg>')
    expect(getCachedRender(key)).toBe('<svg>diagram</svg>')
  })

  it('keys by jarPath + source so different inputs do not collide', () => {
    const a = renderCacheKey(JAR, 'source-a')
    const b = renderCacheKey(JAR, 'source-b')
    const c = renderCacheKey('/other/plantuml.jar', 'source-a')
    setCachedRender(a, '<svg>a</svg>')
    setCachedRender(b, '<svg>b</svg>')
    setCachedRender(c, '<svg>c</svg>')
    expect(getCachedRender(a)).toBe('<svg>a</svg>')
    expect(getCachedRender(b)).toBe('<svg>b</svg>')
    expect(getCachedRender(c)).toBe('<svg>c</svg>')
  })

  it('LRU-evicts the oldest entry once the entry cap is exceeded', () => {
    for (let i = 0; i <= PLANTUML_RENDER_CACHE_MAX_ENTRIES; i++) {
      setCachedRender(renderCacheKey(JAR, `source-${i}`), `<svg>${i}</svg>`)
    }
    expect(plantumlRenderCacheSizeForTests()).toBe(PLANTUML_RENDER_CACHE_MAX_ENTRIES)
    // source-0 was the first inserted and never re-read, so it is evicted first.
    expect(getCachedRender(renderCacheKey(JAR, 'source-0'))).toBeUndefined()
    expect(getCachedRender(renderCacheKey(JAR, 'source-1'))).toBe('<svg>1</svg>')
  })

  it('a cache hit bumps recency so it survives eviction', () => {
    setCachedRender(renderCacheKey(JAR, 'source-0'), '<svg>0</svg>')
    for (let i = 1; i < PLANTUML_RENDER_CACHE_MAX_ENTRIES; i++) {
      setCachedRender(renderCacheKey(JAR, `source-${i}`), `<svg>${i}</svg>`)
    }
    // Re-read the oldest so it is no longer the LRU victim.
    expect(getCachedRender(renderCacheKey(JAR, 'source-0'))).toBe('<svg>0</svg>')
    // One more insert pushes past the cap; source-1 is now the oldest, not source-0.
    setCachedRender(renderCacheKey(JAR, 'source-overflow'), '<svg>x</svg>')
    expect(getCachedRender(renderCacheKey(JAR, 'source-0'))).toBe('<svg>0</svg>')
    expect(getCachedRender(renderCacheKey(JAR, 'source-1'))).toBeUndefined()
  })

  it('evicts by total bytes when the byte budget is exceeded', () => {
    setPlantumlRenderCacheMaxBytesForTests(100)
    setCachedRender(renderCacheKey(JAR, 'a'), 'x'.repeat(60))
    setCachedRender(renderCacheKey(JAR, 'b'), 'y'.repeat(60))
    // 60 + 60 > 100, so the oldest ('a') is evicted to fit the budget.
    expect(getCachedRender(renderCacheKey(JAR, 'a'))).toBeUndefined()
    expect(getCachedRender(renderCacheKey(JAR, 'b'))).toBe('y'.repeat(60))
  })

  it('keeps a single oversized entry rather than re-rendering it every read', () => {
    setPlantumlRenderCacheMaxBytesForTests(100)
    const key = renderCacheKey(JAR, 'huge')
    setCachedRender(key, 'z'.repeat(500))
    // Over budget on its own, but the most-recent entry is never dropped.
    expect(getCachedRender(key)).toBe('z'.repeat(500))
    expect(plantumlRenderCacheSizeForTests()).toBe(1)
  })
})
