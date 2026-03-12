---
name: anti-patterns
description: Common mistakes when using neo.lumen — immediate mode logs without response data, redaction is string-level regex not structured, sampling is Math.random not crypto-secure, onStats is not yet implemented, stream errors silently caught, unknown tokens throw at compile time not runtime, skip receives incomplete res for aborted requests, request ID requires Node 15.7+
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Anti-Patterns for @lpm.dev/neo.lumen

### [CRITICAL] `immediate: true` logs without response data

Wrong:

```typescript
// AI enables immediate mode and uses response tokens
app.use(lumen(':method :url :status :response-time ms', {
  immediate: true,
}))
// Output: GET /api/users - - ms
// :status and :response-time are undefined — response hasn't happened yet!
```

Correct:

```typescript
// Immediate mode: only use request tokens
app.use(lumen(':method :url :remote-addr :user-agent', {
  immediate: true,
}))
// Logs immediately on request — before the handler runs

// Default (immediate: false): use any tokens
app.use(lumen(':method :url :status :response-time ms'))
// Logs after response — all tokens available
```

When `immediate: true`, the log is written when the request arrives, before the handler processes it. Response-related tokens (`:status`, `:response-time`, `:total-time`, `:res[header]`) are not available and output as `-`. Use immediate mode only when you need to log request data regardless of whether the server crashes during processing.

Source: `src/core/logger.ts` — immediate logging fires before `res.end()`

### [CRITICAL] Redaction is string-level regex — not structured field masking

Wrong:

```typescript
// AI relies on redaction for compliance (GDPR, HIPAA)
app.use(lumen('json', {
  redact: ['password'],
}))

// Assumes this catches all password occurrences:
// POST /api {"password":"secret"} → NOT redacted (body not logged)
// URL-encoded: password%3Dsecret → NOT redacted (encoded)
// Multi-word: "password": "my secret value" → partially redacted
```

Correct:

```typescript
// Redaction is a convenience layer, not a security guarantee
app.use(lumen('combined', {
  redact: ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'],
}))

// What it catches:
// password=secret123 → password=***REDACTED***
// authorization:Bearer xxx → authorization:***REDACTED***
// token abc123 → token ***REDACTED***

// What it doesn't catch:
// URL-encoded values
// Multi-word quoted values
// Nested JSON fields
// Custom token output (redact in the token function itself)

// For compliance: use structured logging with field-level controls
// at the log aggregation layer (Datadog, Splunk, etc.)
```

Redaction uses a simple regex matching `pattern[=:\s]+value` on the final log line string. It's case-insensitive and catches common query string and header patterns. It is not a substitute for structured PII protection.

Source: `src/core/logger.ts` — `redactSensitiveData()` regex

### [HIGH] `onStats` is defined in types but NOT implemented

Wrong:

```typescript
// AI uses onStats expecting it to fire
app.use(lumen('dev', {
  onStats: (stats) => {
    // This callback is NEVER called!
    metrics.gauge('http.requests', stats.count)
  },
}))
```

Correct:

```typescript
// onStats is a planned feature — not yet functional
// For request counting, implement a simple wrapper:

let requestCount = 0

app.use((req, res, next) => {
  requestCount++
  next()
})

app.use(lumen('dev'))

// Report periodically
setInterval(() => {
  console.log({ requests: requestCount })
  requestCount = 0
}, 60_000)

// For production metrics, use your APM agent (Datadog, New Relic, Prometheus)
```

The `onStats` option and `LoggerStats` type exist in the type definitions but the callback is never invoked in the current implementation. It is accepted without error but silently ignored.

Source: `src/types.ts` — `StatsHandler` type defined, `src/core/logger.ts` — never called

### [HIGH] Unknown tokens throw at compile time — not runtime

Wrong:

```typescript
// AI uses a misspelled or nonexistent token
app.use(lumen(':method :url :stats :response-time ms'))
// Throws immediately when the middleware is created!
// Error: Unknown token 'stats'. Did you mean 'status'?
```

Correct:

```typescript
// Register custom tokens BEFORE using them in format strings
import lumen from '@lpm.dev/neo.lumen'

// Register first
lumen.token('request-size', (req) => req.headers['content-length'] || '0')

// Then use in format string
app.use(lumen(':method :url :request-size :status'))

// All built-in tokens:
// :method, :url, :status, :response-time, :total-time,
// :http-version, :remote-addr, :remote-user, :user-agent,
// :referrer, :date, :id, :req[header], :res[header]
```

Format strings are compiled at middleware creation time, not per-request. If a token name is not recognized (not built-in and not registered via `lumen.token()`), an error is thrown immediately with a suggestion for the closest match. This is by design — catching typos early is better than silent failures in production.

Source: `src/formats/compiler.ts` — token validation at compile time

### [HIGH] Stream errors are silently caught — logs may be lost

Wrong:

```typescript
// AI assumes all logs are guaranteed to be written
const logStream = fs.createWriteStream('/var/log/app.log')

app.use(lumen('combined', { stream: logStream }))
// If the stream errors (disk full, permission denied), logs are silently dropped
// The server continues running — no crash, but no logs
```

Correct:

```typescript
import lumen from '@lpm.dev/neo.lumen'
import fs from 'node:fs'

const logStream = fs.createWriteStream('/var/log/app.log', { flags: 'a' })

// Monitor stream errors separately
logStream.on('error', (err) => {
  console.error('Log stream error:', err)
  // Alert, fallback to stdout, etc.
})

// Use onError for per-request logging failures
app.use(lumen('combined', {
  stream: logStream,
  onError: (err, req, res) => {
    // Fallback logging
    process.stderr.write(`Log error: ${err.message}\n`)
  },
}))
```

lumen catches stream write errors to prevent the server from crashing due to logging failures. This means a broken log stream (full disk, closed pipe) will silently lose logs. Use the `onError` callback and monitor your stream's error events to detect this.

Source: `src/core/output.ts` — try/catch around stream.write

### [MEDIUM] `skip` function receives incomplete `res` for aborted requests

Wrong:

```typescript
// AI assumes res always has a statusCode in skip
app.use(lumen('dev', {
  skip: (req, res) => {
    return res.statusCode === 200  // May be undefined for aborted requests!
  },
}))
```

Correct:

```typescript
app.use(lumen('dev', {
  skip: (req, res) => {
    // Default statusCode is 200 in Node.js, but check explicitly
    const status = res.statusCode ?? 0
    return status >= 200 && status < 400
  },
}))

// For request-only filtering, use req properties:
app.use(lumen('dev', {
  skip: (req) => req.url === '/health' || req.url === '/ready',
}))
```

The `skip` function runs after the response completes (unless `immediate: true`). For aborted or timed-out requests, `res.statusCode` may not reflect the actual outcome. For reliable filtering, prefer request-based conditions (URL, method, headers) over response-based ones.

Source: `src/core/logger.ts` — skip called in `res.on('finish')` handler

### [MEDIUM] Sampling uses `Math.random()` — not cryptographically secure

Wrong:

```typescript
// AI uses sampling for security-sensitive audit logging
app.use(lumen('combined', {
  sample: 0.5,  // Log 50% of requests
}))
// Some requests won't be logged — not suitable for audit trails
```

Correct:

```typescript
// Sampling is for high-traffic performance optimization, not audit logging
// Use for: reducing log volume on high-traffic routes
app.use(lumen('json', {
  sample: 0.1,  // Log 10% — reduces log volume 10x
}))

// For audit logging: never use sampling
app.use(lumen('json', {
  // Log everything, filter by route if needed
  skip: (req) => req.url === '/health',
}))

// For smart sampling: always log errors, sample success
app.use(lumen('json', {
  skip: (req, res) => {
    if (res.statusCode >= 400) return false  // Always log errors
    return Math.random() > 0.1  // Sample 10% of successful requests
  },
}))
```

The `sample` option uses `Math.random()` which is not cryptographically secure and not uniformly distributed at small sample sizes. It's designed for reducing log volume in high-traffic applications, not for security-sensitive sampling. For audit trails, log every request.

Source: `src/core/logger.ts` — `Math.random() > options.sample`

### [MEDIUM] Request ID requires Node.js 15.7+ (`crypto.randomUUID`)

Wrong:

```typescript
// AI enables request IDs on an older Node.js version
app.use(lumen('dev', {
  includeRequestId: true,
}))
// Throws: crypto.randomUUID is not a function (Node.js < 15.7)
```

Correct:

```typescript
// Requires Node.js >= 15.7 for crypto.randomUUID()
// Package engines field specifies >= 18.0.0

// If on an older Node.js version (not recommended):
import { randomUUID } from 'node:crypto'

// The package requires Node.js 18+, so this shouldn't be an issue
// in practice. But if you're running in an unusual environment:
lumen.token('id', () => {
  try {
    return crypto.randomUUID()
  } catch {
    return Math.random().toString(36).slice(2)
  }
})
```

The `includeRequestId` option uses `crypto.randomUUID()` which was added in Node.js 15.7.0 and is stable from Node.js 19+. The package requires Node.js >= 18.0.0 where it's available but still marked as experimental until Node.js 19.

Source: `src/core/context.ts` — `crypto.randomUUID()`
