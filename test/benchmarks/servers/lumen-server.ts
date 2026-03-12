#!/usr/bin/env node
/**
 * lumen HTTP server
 * Benchmarks lumen middleware performance
 */

import { createServer } from 'node:http'
import lumen from '../../../src/index.js'
import { Writable } from 'node:stream'

const PORT = parseInt(process.env.PORT || '3000', 10)
const FORMAT = process.env.FORMAT || 'dev'

// Null stream to discard output (realistic benchmark)
class NullStream extends Writable {
  _write(_chunk: any, _encoding: string, callback: () => void) {
    callback()
  }
}

const logger = lumen(FORMAT, { stream: new NullStream() })

const server = createServer((req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
  })
})

server.listen(PORT, () => {
  console.log(`lumen server (${FORMAT} format) running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.close(() => {
    console.log('Server stopped')
    process.exit(0)
  })
})
