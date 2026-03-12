import { describe, it, expect, vi } from 'vitest'
import lumen from '../../src/index.js'
import type { Request, Response } from '../../src/types.js'
import { Writable } from 'node:stream'

/**
 * Create mock request
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/test',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    headers: {},
    socket: {
      remoteAddress: '127.0.0.1'
    },
    ...overrides
  } as Request
}

/**
 * Create mock response
 */
function createMockResponse(overrides: Partial<Response> = {}): Response {
  const listeners: Record<string, Function[]> = {}

  const res: any = {
    statusCode: 200,
    headersSent: false,
    _headers: {},
    on(event: string, listener: Function) {
      if (!listeners[event]) listeners[event] = []
      listeners[event]!.push(listener)
      return this
    },
    emit(event: string, ...args: any[]) {
      if (listeners[event]) {
        listeners[event]!.forEach(fn => fn(...args))
      }
      return true
    },
    setHeader(name: string, value: any) {
      this._headers[name] = value
      this.headersSent = true
      return this
    },
    getHeader(name: string) {
      return this._headers[name]
    },
    ...overrides
  }

  return res as Response
}

/**
 * Create writable stream that collects output
 */
function createTestStream(): { stream: Writable; getLogs: () => string[] } {
  const logs: string[] = []

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logs.push(chunk.toString().trim())
      callback()
    }
  })

  return {
    stream,
    getLogs: () => logs
  }
}

describe('lumen', () => {
  it('creates logger middleware', () => {
    const logger = lumen()
    expect(typeof logger).toBe('function')
  })

  it('logs request with dev format', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen('dev', { stream })

    const req = createMockRequest()
    const res = createMockResponse()
    const next = vi.fn()

    logger(req, res, next)
    expect(next).toHaveBeenCalled()

    // Mark headers as sent
    res.headersSent = true

    // Trigger finish event
    res.emit('finish')

    // Wait for async log
    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0]).toContain('GET /test')
    expect(logs[0]).toContain('200')
  })

  it('logs with custom format string', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen(':method :url :status', { stream })

    const req = createMockRequest()
    const res = createMockResponse()
    const next = vi.fn()

    logger(req, res, next)
    res.headersSent = true
    res.emit('finish')

    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs[0]).toBe('GET /test 200')
  })

  it('supports request ID generation', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen(':id :method :url', {
      stream,
      includeRequestId: true
    })

    const req = createMockRequest()
    const res = createMockResponse()
    const next = vi.fn()

    logger(req, res, next)
    res.headersSent = true

    // Check request ID header was set
    expect(res.getHeader('X-Request-ID')).toBeDefined()

    res.emit('finish')
    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs[0]).toMatch(/^[0-9a-f-]+ GET \/test$/)
  })

  it('redacts sensitive data', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen(':method :url', {
      stream,
      redact: ['password', 'token']
    })

    const req = createMockRequest({
      url: '/login?password=secret123&token=abc'
    })
    const res = createMockResponse()
    const next = vi.fn()

    logger(req, res, next)
    res.headersSent = true
    res.emit('finish')

    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs[0]).not.toContain('secret123')
    expect(logs[0]).not.toContain('abc')
    expect(logs[0]).toContain('***REDACTED***')
  })

  it('skips logging based on skip function', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen('tiny', {
      stream,
      skip: (req, res) => res.statusCode < 400
    })

    const req = createMockRequest()
    const res = createMockResponse({ statusCode: 200 })
    const next = vi.fn()

    logger(req, res, next)
    res.headersSent = true
    res.emit('finish')

    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs.length).toBe(0)
  })

  it('samples requests', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen('tiny', {
      stream,
      sample: 0.5 // 50% sampling
    })

    const next = vi.fn()
    let logged = 0

    // Run 100 requests
    for (let i = 0; i < 100; i++) {
      const req = createMockRequest()
      const res = createMockResponse()

      logger(req, res, next)
      res.headersSent = true
      res.emit('finish')
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    logged = getLogs().length

    // Should be around 50 (with some variance)
    expect(logged).toBeGreaterThan(30)
    expect(logged).toBeLessThan(70)
  })

  it('logs immediately when immediate option is true', async () => {
    const { stream, getLogs } = createTestStream()
    const logger = lumen('tiny', {
      stream,
      immediate: true
    })

    const req = createMockRequest()
    const res = createMockResponse()
    const next = vi.fn()

    logger(req, res, next)

    // Don't emit finish, log should happen immediately
    await new Promise(resolve => setTimeout(resolve, 10))

    const logs = getLogs()
    expect(logs.length).toBe(1)
  })
})
