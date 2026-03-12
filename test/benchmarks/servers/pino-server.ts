#!/usr/bin/env node
/**
 * pino HTTP server
 * Benchmarks pino-http middleware performance
 */

import { createServer } from 'node:http'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { Writable } from 'node:stream'

const PORT = parseInt(process.env.PORT || '3000', 10)

// Null stream to discard output
class NullStream extends Writable {
  _write(_chunk: any, _encoding: string, callback: () => void) {
    callback()
  }
}

// Create pino logger with extreme mode (fastest)
const logger = pino(
  {
    level: 'info',
    // Use extreme mode for best performance
    extreme: true
  },
  new NullStream()
)

const httpLogger = pinoHttp({ logger })

const server = createServer((req, res) => {
  httpLogger(req, res)
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('OK')
})

server.listen(PORT, () => {
  console.log(`pino server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.close(() => {
    logger.flush()
    console.log('Server stopped')
    process.exit(0)
  })
})
