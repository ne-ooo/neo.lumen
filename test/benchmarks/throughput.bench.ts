import { bench, describe } from 'vitest'
import lumen from '../../src/index.js'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
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
 * Simple request handler
 */
function handler(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('OK')
}

/**
 * Make HTTP request
 */
async function makeRequest(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = createServer().request(
      {
        port,
        method: 'GET',
        path: '/test'
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', resolve)
      }
    )

    req.on('error', reject)
    req.end()
  })
}

/**
 * Simulate middleware execution
 */
function simulateMiddleware(
  middleware: any,
  iterations: number
): Promise<void> {
  return new Promise((resolve) => {
    const nullStream = new NullStream()
    let completed = 0

    for (let i = 0; i < iterations; i++) {
      const req: any = {
        method: 'GET',
        url: '/test',
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      const res: any = {
        statusCode: 200,
        headersSent: false,
        _headers: {},
        setHeader(name: string, value: any) {
          this._headers[name] = value
          this.headersSent = true
        },
        getHeader(name: string) {
          return this._headers[name]
        },
        on(_event: string, _fn: Function) {
          // Immediately call finish for benchmark
          if (_event === 'finish') {
            setImmediate(() => {
              this.headersSent = true
              _fn()
            })
          }
        },
        emit(_event: string) {}
      }

      middleware(req, res, () => {
        res.headersSent = true
        res.emit('finish')

        completed++
        if (completed === iterations) {
          resolve()
        }
      })
    }
  })
}

describe('Throughput Benchmarks', () => {
  const iterations = 1000

  bench('baseline (no logging)', async () => {
    await simulateMiddleware(
      (_req: any, _res: any, next: Function) => next(),
      iterations
    )
  })

  bench('lumen - dev format', async () => {
    const logger = lumen('dev', { stream: new NullStream() })
    await simulateMiddleware(logger, iterations)
  })

  bench('lumen - tiny format', async () => {
    const logger = lumen('tiny', { stream: new NullStream() })
    await simulateMiddleware(logger, iterations)
  })

  bench('lumen - json format', async () => {
    const logger = lumen('json', { stream: new NullStream() })
    await simulateMiddleware(logger, iterations)
  })

  bench('lumen - combined format', async () => {
    const logger = lumen('combined', { stream: new NullStream() })
    await simulateMiddleware(logger, iterations)
  })

  bench('lumen - with request ID', async () => {
    const logger = lumen('dev', {
      stream: new NullStream(),
      includeRequestId: true
    })
    await simulateMiddleware(logger, iterations)
  })

  bench('lumen - with redaction', async () => {
    const logger = lumen('dev', {
      stream: new NullStream(),
      redact: ['password', 'token']
    })
    await simulateMiddleware(logger, iterations)
  })
})
