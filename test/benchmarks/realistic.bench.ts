import { bench, describe } from 'vitest'
import lumen from '../../src/index.js'
import { Writable } from 'node:stream'

/**
 * Null stream (discards all output)
 */
class NullStream extends Writable {
  _write(_chunk: any, _encoding: string, callback: () => void) {
    callback()
  }
}

/**
 * Create mock request
 */
function createMockReq(): any {
  return {
    method: 'GET',
    url: '/api/test',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    headers: {
      'user-agent': 'benchmark/1.0',
      'content-type': 'application/json'
    },
    socket: {
      remoteAddress: '127.0.0.1'
    }
  }
}

/**
 * Create mock response
 */
function createMockRes(): any {
  const listeners: Map<string, Function[]> = new Map()

  return {
    statusCode: 200,
    headersSent: false,
    _headers: {} as Record<string, any>,

    on(event: string, fn: Function) {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(fn)
      return this
    },

    emit(event: string) {
      const fns = listeners.get(event)
      if (fns) {
        for (const fn of fns) {
          fn()
        }
      }
      return true
    },

    setHeader(name: string, value: any) {
      this._headers[name] = value
      return this
    },

    getHeader(name: string) {
      return this._headers[name]
    }
  }
}

/**
 * Synchronous benchmark - measures middleware overhead
 */
function benchmarkSync(middleware: any, iterations: number): void {
  for (let i = 0; i < iterations; i++) {
    const req = createMockReq()
    const res = createMockRes()

    // Call middleware
    middleware(req, res, () => {})

    // Simulate response finish
    res.headersSent = true
    res.emit('finish')
  }
}

describe('Realistic Throughput', () => {
  const iterations = 10000

  bench('baseline (no middleware)', () => {
    benchmarkSync((_req: any, _res: any, next: Function) => next(), iterations)
  })

  bench('lumen - dev format', () => {
    const logger = lumen('dev', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - tiny format', () => {
    const logger = lumen('tiny', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - json format', () => {
    const logger = lumen('json', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - combined format', () => {
    const logger = lumen('combined', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - with request ID', () => {
    const logger = lumen('dev', {
      stream: new NullStream(),
      includeRequestId: true
    })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - with redaction', () => {
    const logger = lumen('dev', {
      stream: new NullStream(),
      redact: ['password', 'token', 'apiKey']
    })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - all features', () => {
    const logger = lumen('dev', {
      stream: new NullStream(),
      includeRequestId: true,
      redact: ['password', 'token', 'apiKey'],
      skip: (req, res) => res.statusCode < 400
    })
    benchmarkSync(logger, iterations)
  })
})

/**
 * Single request latency
 */
describe('Latency (single request overhead)', () => {
  const iterations = 1

  bench('baseline', () => {
    benchmarkSync((_req: any, _res: any, next: Function) => next(), iterations)
  })

  bench('lumen - dev', () => {
    const logger = lumen('dev', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })

  bench('lumen - json', () => {
    const logger = lumen('json', { stream: new NullStream() })
    benchmarkSync(logger, iterations)
  })
})
