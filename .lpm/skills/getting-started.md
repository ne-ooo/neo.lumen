---
name: getting-started
description: How to use neo.lumen — Express/Connect HTTP logging middleware, predefined formats (dev, tiny, json, combined, common, short), custom format strings with tokens, custom format functions, options (stream, skip, sample, immediate, includeRequestId, redact), custom tokens, custom formats, compile(), production patterns, TypeScript types
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Getting Started with @lpm.dev/neo.lumen

## Overview

neo.lumen is a zero-dependency HTTP request logging middleware for Express/Connect. 4.2x faster than morgan, built-in request IDs, data redaction, and sampling. Drop-in morgan replacement.

## Quick Start

```typescript
import express from 'express'
import lumen from '@lpm.dev/neo.lumen'

const app = express()

// Development — colored output
app.use(lumen('dev'))
// GET /api/users 200 4.521 ms - 1234

// Production — structured JSON
app.use(lumen('json', {
  includeRequestId: true,
  redact: ['password', 'token', 'authorization'],
}))

app.listen(3000)
```

## Factory Function

```typescript
import lumen from '@lpm.dev/neo.lumen'

// Predefined format name
lumen('dev')
lumen('combined')

// Custom format string with tokens
lumen(':method :url :status :response-time ms')

// Custom format function
lumen((tokens, req, res) => {
  return `${tokens.method(req, res)} ${tokens.url(req, res)} ${tokens.status(req, res)}`
})

// Format + options
lumen('json', { includeRequestId: true })
```

## Predefined Formats

| Format | Output | Use case |
|--------|--------|----------|
| `dev` | `GET /api/users 200 4.521 ms - 1234` | Development (colored by status) |
| `tiny` | `GET /api/users 200 1234 - 4.521 ms` | Minimal output |
| `json` | `{"timestamp":"...","method":"GET","url":"/api/users","status":200,...}` | Production / log aggregation |
| `combined` | Apache combined log format | Compatibility with log analyzers |
| `common` | Apache common log format | Compatibility with log analyzers |
| `short` | Short format with response time | Balance of detail and brevity |

## Built-in Tokens

Use in format strings as `:token-name` or `:token-name[argument]`.

### Request Tokens

```typescript
':method'          // GET, POST, PUT, DELETE, etc.
':url'             // Request URL (uses req.originalUrl if available)
':http-version'    // HTTP version (1.1, 2.0)
':remote-addr'     // Client IP address
':user-agent'      // User-Agent header
':referrer'        // Referer header
':remote-user'     // Username from Basic auth
':req[header]'     // Any request header — e.g., ':req[content-type]'
```

### Response Tokens

```typescript
':status'              // HTTP status code
':res[header]'         // Any response header — e.g., ':res[content-length]'
':response-time'       // Duration in ms (3 decimal places)
':response-time[0]'    // Duration in ms (0 decimal places)
':total-time'          // Total request time
':total-time[2]'       // Total time with 2 decimal places
```

### Metadata Tokens

```typescript
':date'            // UTC date string (default)
':date[clf]'       // Common Log Format: 17/Feb/2026:10:30:45 +0000
':date[iso]'       // ISO 8601: 2026-02-17T10:30:45.123Z
':date[web]'       // UTC string (same as default)
':id'              // Request ID (requires includeRequestId: true)
```

## Options

```typescript
lumen('dev', {
  // Output destination (default: process.stdout)
  stream: fs.createWriteStream('/var/log/app.log', { flags: 'a' }),

  // Skip logging for certain requests
  skip: (req, res) => req.url === '/health',

  // Sample rate: 0-1 (e.g., 0.1 = log 10% of requests)
  sample: 0.1,

  // Log on request instead of response (no status/timing available)
  immediate: false,

  // Generate UUID request IDs (sets X-Request-ID header)
  includeRequestId: true,

  // Redact sensitive data from log output
  redact: ['password', 'token', 'apiKey', 'secret', 'authorization'],

  // Error handler for logging failures
  onError: (err, req, res) => console.error('Log error:', err),
})
```

## Custom Tokens

```typescript
import lumen from '@lpm.dev/neo.lumen'

// Register custom tokens (chainable)
lumen
  .token('user-id', (req) => req.user?.id || '-')
  .token('tenant', (req) => req.tenant?.name || '-')
  .token('body-size', (req, res) => res.getHeader('content-length') || '0')

// Use in format strings
app.use(lumen(':user-id :tenant :method :url :status :response-time ms'))
```

## Custom Formats

```typescript
// Register a reusable format
lumen.format('api', ':date[iso] :id :method :url :status :response-time ms')
lumen.format('audit', (tokens, req, res) => {
  return JSON.stringify({
    user: req.user?.id,
    action: tokens.method(req, res),
    resource: tokens.url(req, res),
    status: tokens.status(req, res),
  })
})

// Use by name
app.use(lumen('api', { includeRequestId: true }))
app.use(lumen('audit'))
```

## Pre-Compiled Formats

```typescript
import lumen, { compile } from '@lpm.dev/neo.lumen'

// Pre-compile a format string (cached)
const fmt = compile(':method :url :status :response-time ms')

// Use the compiled function
app.use(lumen(fmt))
```

## Request IDs

```typescript
app.use(lumen('dev', { includeRequestId: true }))

// Generates UUID v4 per request via crypto.randomUUID()
// Sets X-Request-ID response header automatically
// Available as :id token in format strings

// Use for request correlation:
lumen(':date[iso] [:id] :method :url :status :response-time ms')
// 2026-02-17T10:30:45.123Z [a1b2c3d4-...] GET /api/users 200 4.521 ms
```

Request IDs are for single-service correlation, not distributed tracing. To integrate with OpenTelemetry, override the `:id` token with your trace ID:

```typescript
lumen.token('id', (req) => {
  const span = trace.getActiveSpan()
  return span?.spanContext().traceId ?? crypto.randomUUID()
})
```

## Data Redaction

```typescript
app.use(lumen('combined', {
  redact: ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'],
}))

// Input:  GET /login?password=secret123&email=user@example.com
// Output: GET /login?password=***REDACTED***&email=user@example.com
```

No default patterns — you must explicitly configure what to redact. Redaction is case-insensitive and matches `pattern=value`, `pattern:value`, and `pattern value` forms. It operates on the final log line string, not structured data.

## Production Setup

```typescript
// Recommended production configuration
app.use(lumen('json', {
  includeRequestId: true,
  redact: ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie', 'session'],
  skip: (req) => req.url === '/health' || req.url === '/ready',
  onError: (err) => console.error('Logging error:', err),
}))
```

### High-Traffic Sampling

```typescript
app.use(lumen('json', {
  skip: (req, res) => {
    // Always log errors
    if (res.statusCode >= 400) return false
    // Sample 10% of successful requests
    return Math.random() > 0.1
  },
}))
```

### Error-Only Logging

```typescript
app.use(lumen('dev', {
  skip: (req, res) => res.statusCode < 400,
}))
```

## No Body Logging (By Design)

lumen does not log request or response bodies. This is a deliberate design decision:
- **Performance** — body buffering adds CPU/memory overhead to every request
- **Privacy** — bodies contain sensitive data (passwords, PII, tokens)
- **Volume** — bodies can be arbitrarily large (file uploads)

lumen logs request metadata (method, URL, status, timing) — the data needed for monitoring and debugging. For body capture, use your APM agent or a dedicated audit logging package.

## TypeScript Types

```typescript
import type {
  LumnrOptions,     // { format?, stream?, skip?, sample?, immediate?, includeRequestId?, redact?, onError? }
  Request,          // IncomingMessage + originalUrl, user, etc.
  Response,         // ServerResponse
  RequestHandler,   // (req, res, next) => void
  FormatFn,         // (tokens, req, res) => string
  TokenFn,          // (req, res) => string
  CompiledFormat,   // Pre-compiled format function
  SkipFn,           // (req, res) => boolean
  ErrorHandler,     // (err, req, res) => void
} from '@lpm.dev/neo.lumen'
```
