import { describe, it, expect } from 'vitest'
import { compileFormat, clearFormatCache } from '../../src/formats/compiler.js'
import { builtInTokens } from '../../src/formats/tokens.js'
import type { Request, Response } from '../../src/types.js'

function createMockReq(): Request {
  return {
    method: 'GET',
    url: '/test',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    headers: {
      'user-agent': 'test-agent'
    },
    socket: {
      remoteAddress: '127.0.0.1'
    }
  } as Request
}

function createMockRes(): Response {
  return {
    statusCode: 200,
    headersSent: true,
    getHeader: (name: string) => name === 'content-length' ? '100' : undefined
  } as Response
}

describe('Format Compiler', () => {
  it('compiles simple format', () => {
    const formatFn = compileFormat(':method :url', builtInTokens)
    const line = formatFn(builtInTokens, createMockReq(), createMockRes())

    expect(line).toBe('GET /test')
  })

  it('compiles format with literals', () => {
    const formatFn = compileFormat(':method :url :status', builtInTokens)
    const line = formatFn(builtInTokens, createMockReq(), createMockRes())

    expect(line).toBe('GET /test 200')
  })

  it('compiles format with token arguments', () => {
    const formatFn = compileFormat(':res[content-length]', builtInTokens)
    const line = formatFn(builtInTokens, createMockReq(), createMockRes())

    expect(line).toBe('100')
  })

  it('caches compiled formats', () => {
    const format = ':method :url'
    const fn1 = compileFormat(format, builtInTokens)
    const fn2 = compileFormat(format, builtInTokens)

    expect(fn1).toBe(fn2)
  })

  it('throws error for unknown token', () => {
    expect(() => {
      compileFormat(':unknown-token', builtInTokens)
    }).toThrow(/Unknown token/)
  })

  it('handles missing token values with dash', () => {
    const formatFn = compileFormat(':res[x-custom]', builtInTokens)
    const line = formatFn(builtInTokens, createMockReq(), createMockRes())

    expect(line).toBe('-')
  })
})

describe('Built-in Tokens', () => {
  it('method token', () => {
    const token = builtInTokens.get('method')!
    expect(token(createMockReq(), createMockRes())).toBe('GET')
  })

  it('url token', () => {
    const token = builtInTokens.get('url')!
    expect(token(createMockReq(), createMockRes())).toBe('/test')
  })

  it('status token', () => {
    const token = builtInTokens.get('status')!
    expect(token(createMockReq(), createMockRes())).toBe('200')
  })

  it('response-time token with precision', () => {
    const token = builtInTokens.get('response-time')!

    // Import context to set start time
    import('../../src/core/context.js').then(({ createContext }) => {
      const req = createMockReq()
      createContext(req)

      const time = token(req, createMockRes(), '0')
      expect(time).toMatch(/^\d+$/)
    })
  })

  it('user-agent token', () => {
    const token = builtInTokens.get('user-agent')!
    expect(token(createMockReq(), createMockRes())).toBe('test-agent')
  })

  describe('remote-user token', () => {
    const token = builtInTokens.get('remote-user')!

    it('extracts username from Basic auth header', () => {
      const req = createMockReq()
      req.headers['authorization'] = `Basic ${Buffer.from('alice:password123').toString('base64')}`
      expect(token(req, createMockRes())).toBe('alice')
    })

    it('handles passwords containing colons', () => {
      const req = createMockReq()
      req.headers['authorization'] = `Basic ${Buffer.from('bob:pass:with:colons').toString('base64')}`
      expect(token(req, createMockRes())).toBe('bob')
    })

    it('returns undefined when no authorization header', () => {
      expect(token(createMockReq(), createMockRes())).toBeUndefined()
    })

    it('returns undefined for non-Basic auth schemes', () => {
      const req = createMockReq()
      req.headers['authorization'] = 'Bearer some-jwt-token'
      expect(token(req, createMockRes())).toBeUndefined()
    })

    it('returns undefined for empty Basic value', () => {
      const req = createMockReq()
      req.headers['authorization'] = 'Basic'
      expect(token(req, createMockRes())).toBeUndefined()
    })

    it('returns undefined for empty username', () => {
      const req = createMockReq()
      req.headers['authorization'] = `Basic ${Buffer.from(':password').toString('base64')}`
      expect(token(req, createMockRes())).toBeUndefined()
    })

    it('handles username without password (no colon)', () => {
      const req = createMockReq()
      req.headers['authorization'] = `Basic ${Buffer.from('justuser').toString('base64')}`
      expect(token(req, createMockRes())).toBe('justuser')
    })

    it('is case-insensitive for Basic scheme', () => {
      const req = createMockReq()
      req.headers['authorization'] = `basic ${Buffer.from('alice:pass').toString('base64')}`
      expect(token(req, createMockRes())).toBe('alice')
    })
  })
})
