// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { fitDiagramCanvas, normalizeDiagramSvg } from './PlantUmlBlock'

describe('normalizeDiagramSvg', () => {
  it('keeps intrinsic dimensions and replaces a stretching aspect ratio', () => {
    const result = normalizeDiagramSvg(
      '<svg width="360" height="180" viewBox="0 0 360 180" preserveAspectRatio="none"><rect /></svg>'
    )
    const svg = new DOMParser().parseFromString(result, 'image/svg+xml').documentElement

    expect(svg.getAttribute('width')).toBe('360')
    expect(svg.getAttribute('height')).toBe('180')
    expect(svg.hasAttribute('style')).toBe(false)
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
  })

  it.each(['', '0 0 0 180', '0 0 360 0', '0 0 360 invalid'])(
    'keeps intrinsic dimensions when viewBox is invalid: %s',
    (viewBox) => {
      const result = normalizeDiagramSvg(
        `<svg width="360" height="180" viewBox="${viewBox}" preserveAspectRatio="none"><rect /></svg>`
      )
      const svg = new DOMParser().parseFromString(result, 'image/svg+xml').documentElement

      expect(svg.getAttribute('width')).toBe('360')
      expect(svg.getAttribute('height')).toBe('180')
      expect(svg.hasAttribute('preserveAspectRatio')).toBe(false)
    }
  )
})

describe('fitDiagramCanvas', () => {
  it('tightens the canvas around the measured diagram with padding', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 2000 1000')
    svg.setAttribute('width', '2000')
    svg.setAttribute('height', '1000')
    Object.defineProperty(svg, 'getBBox', {
      value: () => ({ x: 100, y: 50, width: 200, height: 400 })
    })

    fitDiagramCanvas(svg)

    expect(svg.getAttribute('viewBox')).toBe('88 38 224 424')
    expect(svg.getAttribute('width')).toBe('224')
    expect(svg.getAttribute('height')).toBe('424')
  })

  it('leaves the original canvas when measurement fails', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 2000 1000')
    Object.defineProperty(svg, 'getBBox', {
      value: () => {
        throw new Error('unavailable')
      }
    })

    fitDiagramCanvas(svg)

    expect(svg.getAttribute('viewBox')).toBe('0 0 2000 1000')
  })
})
