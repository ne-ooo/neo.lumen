#!/usr/bin/env node
/**
 * Real HTTP server benchmark
 * Measures actual throughput with real HTTP requests
 *
 * Usage:
 *   1. Start server: node http-server.ts
 *   2. In another terminal: npm install -g autocannon
 *   3. Run benchmark: autocannon -c 100 -d 10 http://localhost:3000
 */

import { createServer } from 'node:http'
import lumen from '../../src/index.js'
import { Writable } from 'node:stream'

// Null stream for benchmarking
class NullStream extends Writable {
  _write(_chunk: any, _encoding: string, callback: () => void) {
    callback()
  }
}

const PORT = 3000
const TEST_SCENARIOS = {
  baseline: 'Baseline (no logging)',
  dev: 'Lumnr dev format',
  tiny: 'Lumnr tiny format',
  json: 'Lumnr JSON format',
  combined: 'Lumnr combined format',
  'request-id': 'Lumnr with request ID',
  redaction: 'Lumnr with redaction',
  all: 'Lumnr with all features'
}

// Get scenario from command line
const scenario = process.argv[2] || 'dev'

if (!Object.keys(TEST_SCENARIOS).includes(scenario)) {
  console.error(`Unknown scenario: ${scenario}`)
  console.error(`Available scenarios: ${Object.keys(TEST_SCENARIOS).join(', ')}`)
  process.exit(1)
}

// Create logger based on scenario
function createLogger(scenario: string) {
  switch (scenario) {
    case 'baseline':
      return (_req: any, _res: any, next: Function) => next()

    case 'dev':
      return lumen('dev', { stream: new NullStream() })

    case 'tiny':
      return lumen('tiny', { stream: new NullStream() })

    case 'json':
      return lumen('json', { stream: new NullStream() })

    case 'combined':
      return lumen('combined', { stream: new NullStream() })

    case 'request-id':
      return lumen('dev', {
        stream: new NullStream(),
        includeRequestId: true
      })

    case 'redaction':
      return lumen('dev', {
        stream: new NullStream(),
        redact: ['password', 'token', 'apiKey']
      })

    case 'all':
      return lumen('dev', {
        stream: new NullStream(),
        includeRequestId: true,
        redact: ['password', 'token', 'apiKey']
      })

    default:
      throw new Error(`Unknown scenario: ${scenario}`)
  }
}

const logger = createLogger(scenario)

// Create server
const server = createServer((req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
  })
})

server.listen(PORT, () => {
  console.log(`\n📊 HTTP Server Benchmark - ${TEST_SCENARIOS[scenario as keyof typeof TEST_SCENARIOS]}\n`)
  console.log(`Server running at http://localhost:${PORT}/`)
  console.log(`\nTo benchmark, run in another terminal:`)
  console.log(`  npm install -g autocannon`)
  console.log(`  autocannon -c 100 -d 10 http://localhost:${PORT}`)
  console.log(`\nPress Ctrl+C to stop\n`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...')
  server.close(() => {
    console.log('Server stopped')
    process.exit(0)
  })
})
