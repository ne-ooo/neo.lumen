#!/usr/bin/env node
/**
 * Example Express application using lumen
 * Demonstrates all major features
 */

import express from 'express'
import lumen from '../src/index.js'

const app = express()
const PORT = 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Example 1: Basic logging with dev format
app.use(lumen('dev'))

// Example 2: Request ID tracking
// app.use(lumen('dev', {
//   includeRequestId: true
// }))

// Example 3: Redact sensitive data
// app.use(lumen('dev', {
//   redact: ['password', 'token', 'apiKey', 'secret']
// }))

// Example 4: Only log errors
// app.use(lumen('dev', {
//   skip: (req, res) => res.statusCode < 400
// }))

// Example 5: Sample 10% of requests
// app.use(lumen('dev', {
//   sample: 0.1
// }))

// Example 6: JSON logging
// app.use(lumen('json'))

// Example 7: Custom format
// app.use(lumen(':method :url :status :response-time ms - :user-agent'))

// Example 8: All features combined
// app.use(lumen('dev', {
//   includeRequestId: true,
//   redact: ['password', 'token'],
//   skip: (req, res) => req.url === '/health',
//   sample: 1.0 // Log 100% in development
// }))

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to lumen example!',
    docs: 'https://github.com/ne-ooo/neo.lumen'
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ]
  })
})

app.post('/api/users', (req, res) => {
  const { name, email } = req.body

  res.status(201).json({
    id: Math.floor(Math.random() * 1000),
    name,
    email
  })
})

// Simulate slow endpoint
app.get('/slow', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 500))
  res.json({ message: 'This was slow' })
})

// Simulate error
app.get('/error', (req, res) => {
  res.status(500).json({ error: 'Something went wrong' })
})

// Login endpoint with sensitive data
app.post('/login', (req, res) => {
  const { email, password } = req.body

  // Simulate authentication
  if (password === 'secret123') {
    res.json({
      success: true,
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
    })
  } else {
    res.status(401).json({
      error: 'Invalid credentials'
    })
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Example Express app running on http://localhost:${PORT}`)
  console.log('\nTry these endpoints:')
  console.log(`  GET  http://localhost:${PORT}/`)
  console.log(`  GET  http://localhost:${PORT}/health`)
  console.log(`  GET  http://localhost:${PORT}/api/users`)
  console.log(`  POST http://localhost:${PORT}/api/users`)
  console.log(`  GET  http://localhost:${PORT}/slow`)
  console.log(`  GET  http://localhost:${PORT}/error`)
  console.log(`  POST http://localhost:${PORT}/login`)
  console.log('\nTo test POST endpoints:')
  console.log(`  curl -X POST http://localhost:${PORT}/api/users -H "Content-Type: application/json" -d '{"name":"Dave","email":"dave@example.com"}'`)
  console.log(`  curl -X POST http://localhost:${PORT}/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"secret123"}'`)
  console.log('\n')
})
