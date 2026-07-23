import { describe, expect, it } from 'vitest'
import {
  normalizeProjectLinkCategory,
  normalizeProjectLinkName,
  normalizeProjectLinkUrl
} from './project-link-normalization'

describe('normalizeProjectLinkName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeProjectLinkName('  Docs  ')).toBe('Docs')
  })

  it('rejects an empty name', () => {
    expect(() => normalizeProjectLinkName('   ')).toThrow()
  })

  it('rejects an over-long name', () => {
    expect(() => normalizeProjectLinkName('a'.repeat(81))).toThrow()
  })
})

describe('normalizeProjectLinkCategory', () => {
  it('allows a blank category', () => {
    expect(normalizeProjectLinkCategory('   ')).toBe('')
  })

  it('trims and keeps a category', () => {
    expect(normalizeProjectLinkCategory('  Production ')).toBe('Production')
  })

  it('rejects an over-long category', () => {
    expect(() => normalizeProjectLinkCategory('a'.repeat(41))).toThrow()
  })
})

describe('normalizeProjectLinkUrl', () => {
  it('defaults a bare host to https', () => {
    expect(normalizeProjectLinkUrl('example.com')).toBe('https://example.com/')
  })

  it('preserves an explicit http scheme', () => {
    expect(normalizeProjectLinkUrl('http://internal.test:8080/path')).toBe(
      'http://internal.test:8080/path'
    )
  })

  it('rejects a blank url', () => {
    expect(() => normalizeProjectLinkUrl('   ')).toThrow()
  })

  it('rejects a javascript: scheme', () => {
    expect(() => normalizeProjectLinkUrl('javascript:alert(1)')).toThrow()
  })

  it('rejects a file: scheme', () => {
    expect(() => normalizeProjectLinkUrl('file:///etc/passwd')).toThrow()
  })

  it('rejects a data: scheme', () => {
    expect(() => normalizeProjectLinkUrl('data:text/html,<script>')).toThrow()
  })

  it('rejects an over-long url', () => {
    expect(() => normalizeProjectLinkUrl(`https://example.com/${'a'.repeat(2100)}`)).toThrow()
  })
})
