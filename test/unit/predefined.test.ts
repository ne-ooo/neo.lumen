import { describe, it, expect } from 'vitest'
import { getFormat, registerFormat, hasFormat, getFormatNames } from '../../src/formats/predefined.js'

describe('getFormat', () => {
  it('returns combined format string', () => {
    const fmt = getFormat('combined')
    expect(typeof fmt === 'string' || typeof fmt === 'function').toBe(true)
    if (typeof fmt === 'string') {
      expect(fmt).toContain(':method')
      expect(fmt).toContain(':status')
    }
  })

  it('returns common format string', () => {
    const fmt = getFormat('common')
    expect(fmt).toBeDefined()
    if (typeof fmt === 'string') {
      expect(fmt).toContain(':remote-addr')
    }
  })

  it('returns dev format (function)', () => {
    const fmt = getFormat('dev')
    expect(typeof fmt).toBe('function')
  })

  it('returns tiny format string', () => {
    const fmt = getFormat('tiny')
    expect(fmt).toBeDefined()
    if (typeof fmt === 'string') {
      expect(fmt).toContain(':method')
    }
  })

  it('returns json format (function)', () => {
    const fmt = getFormat('json')
    expect(typeof fmt).toBe('function')
  })

  it('returns short format string', () => {
    const fmt = getFormat('short')
    expect(fmt).toBeDefined()
  })

  it('returns undefined for unknown format', () => {
    expect(getFormat('does-not-exist-xyz')).toBeUndefined()
  })
})

describe('registerFormat', () => {
  it('registers a string format', () => {
    registerFormat('test-str', ':method :status')
    expect(getFormat('test-str')).toBe(':method :status')
  })

  it('registers a function format', () => {
    const fn = () => 'custom-output'
    registerFormat('test-fn', fn)
    expect(getFormat('test-fn')).toBe(fn)
  })

  it('overwrites an existing format', () => {
    registerFormat('overwrite-me', ':method')
    registerFormat('overwrite-me', ':url')
    expect(getFormat('overwrite-me')).toBe(':url')
  })
})

describe('hasFormat', () => {
  it('returns true for built-in formats', () => {
    expect(hasFormat('dev')).toBe(true)
    expect(hasFormat('combined')).toBe(true)
    expect(hasFormat('tiny')).toBe(true)
    expect(hasFormat('json')).toBe(true)
    expect(hasFormat('short')).toBe(true)
    expect(hasFormat('common')).toBe(true)
  })

  it('returns false for unknown format', () => {
    expect(hasFormat('no-such-format-xyz')).toBe(false)
  })

  it('returns true after registering a custom format', () => {
    registerFormat('my-custom', ':method')
    expect(hasFormat('my-custom')).toBe(true)
  })
})

describe('getFormatNames', () => {
  it('returns an array of strings', () => {
    const names = getFormatNames()
    expect(Array.isArray(names)).toBe(true)
    expect(names.every((n) => typeof n === 'string')).toBe(true)
  })

  it('includes all built-in formats', () => {
    const names = getFormatNames()
    expect(names).toContain('dev')
    expect(names).toContain('combined')
    expect(names).toContain('common')
    expect(names).toContain('tiny')
    expect(names).toContain('short')
    expect(names).toContain('json')
  })

  it('includes newly registered formats', () => {
    registerFormat('unique-format-for-names-test', ':status')
    const names = getFormatNames()
    expect(names).toContain('unique-format-for-names-test')
  })
})
