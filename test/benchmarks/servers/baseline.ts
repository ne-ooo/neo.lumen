#!/usr/bin/env node
/**
 * Baseline HTTP server (no logging)
 * Used to measure raw server performance
 */

import { createServer } from 'node:http'

const PORT = parseInt(process.env.PORT || '3000', 10)

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('OK')
})

server.listen(PORT, () => {
  console.log(`Baseline server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.close(() => {
    console.log('Server stopped')
    process.exit(0)
  })
})
