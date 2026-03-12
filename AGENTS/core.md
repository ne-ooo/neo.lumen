# Core Logging System

## Overview

The core logging system handles request/response lifecycle, timing, and log output.

**Location:** `lumnr/src/core/`

---

## Architecture

```
Request → Logger Middleware → Response
    ↓                              ↓
Start Time                    Log Output
```

**Key Components:**
1. **Logger Factory** - Creates logger instances
2. **Request Context** - Tracks request metadata (WeakMap)
3. **Format Engine** - Compiles format strings into functions
4. **Output Stream** - Writes logs to destination

---

## Core Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main export, logger factory |
| `src/core/logger.ts` | Logger class implementation |
| `src/core/context.ts` | Request context management (WeakMap) |
| `src/core/timing.ts` | High-precision timing (performance.now) |
| `src/core/output.ts` | Stream handling & error recovery |

---

## Logger Pattern

**All loggers follow this pattern:**

```typescript
import lumnr from '@lpm.dev/lpm.lumnr'

// Create logger instance
const logger = lumnr(format, options)

// Use as Express middleware
app.use(logger)

// Logger is a function: (req, res, next) => void
```

**Options:**
```typescript
interface LumnrOptions {
  // When to log
  immediate?: boolean              // Log on request (default: false)
  skip?: (req, res) => boolean    // Skip logging function

  // Where to log
  stream?: NodeJS.WritableStream  // Output stream (default: stdout)

  // What to log
  format?: string | FormatFn      // Format string or function
  jsonOutput?: boolean            // Force JSON output

  // Modern features
  includeRequestId?: boolean      // Generate request IDs
  redact?: string[]              // Sensitive data patterns
  sample?: number                // Sampling rate (0-1)

  // Error handling
  onError?: ErrorHandler         // Custom error handler
}
```

---

## Request Context

**Uses WeakMap for private data (no object pollution):**

```typescript
// Internal storage
const requestContext = new WeakMap<Request, RequestData>()

interface RequestData {
  id?: string              // Request ID (if enabled)
  startTime: number       // performance.now() timestamp
  metadata?: Record<string, unknown>
}

// Set context
requestContext.set(req, {
  startTime: performance.now(),
  id: crypto.randomUUID()
})

// Get context
const ctx = requestContext.get(req)
const duration = performance.now() - ctx.startTime
```

**Why WeakMap:**
- ✅ No pollution of req/res objects
- ✅ Automatic garbage collection
- ✅ No memory leaks
- ✅ True privacy

---

## Timing System

**Uses performance.now() instead of process.hrtime:**

```typescript
import { performance } from 'node:perf_hooks'

// Start timing
const startTime = performance.now()

// Calculate duration
const duration = performance.now() - startTime

// Format with precision
const ms = duration.toFixed(3)  // "12.345 ms"
```

**Benefits:**
- Simpler API (single number vs array)
- More accurate for JS execution timing
- Better browser compatibility (for universal code)
- Monotonic clock (not affected by system time changes)

---

## Lifecycle Events

**Log at different points in the request cycle:**

```typescript
// Option 1: Immediate mode (log on request)
const logger = lumnr('combined', { immediate: true })
// → Logs when request arrives (no response data)

// Option 2: Response mode (log on finish) - DEFAULT
const logger = lumnr('combined')
// → Logs when response completes (full data available)
```

**Event handling:**
```typescript
// Attach to response finish event
res.on('finish', async () => {
  const ctx = requestContext.get(req)
  await writeLog(ctx, req, res)
})
```

---

## Error Handling

**All errors are caught and handled gracefully:**

```typescript
async function writeLog(ctx, req, res) {
  try {
    const line = formatLine(ctx, req, res)
    if (!line) return

    await stream.write(line + '\n')
  } catch (err) {
    // Never crash the server on logging errors
    if (options.onError) {
      options.onError(err, req, res)
    } else {
      console.error('[lumnr] Logging error:', err)
    }
  }
}
```

**Custom error handler:**
```typescript
const logger = lumnr('combined', {
  onError: (err, req, res) => {
    // Send to error tracking service
    errorTracker.captureException(err, {
      context: { url: req.url, method: req.method }
    })
  }
})
```

---

## Stream Handling

**Support any writable stream:**

```typescript
import fs from 'fs'

// File stream
const fileStream = fs.createWriteStream('./access.log', { flags: 'a' })
const logger = lumnr('combined', { stream: fileStream })

// Multiple streams (use custom stream)
class MultiStream {
  constructor(streams) {
    this.streams = streams
  }

  write(chunk) {
    for (const stream of this.streams) {
      stream.write(chunk)
    }
  }
}

const logger = lumnr('combined', {
  stream: new MultiStream([process.stdout, fileStream])
})
```

**Stream error handling:**
```typescript
stream.on('error', (err) => {
  console.error('[lumnr] Stream error:', err)
  // Don't crash - fall back to stderr
  process.stderr.write(`[lumnr] Stream failed, falling back to stderr\n`)
})
```

---

## Skip Logic

**Conditionally skip logging:**

```typescript
// Skip successful requests (only log errors)
const logger = lumnr('combined', {
  skip: (req, res) => res.statusCode < 400
})

// Skip health checks
const logger = lumnr('combined', {
  skip: (req, res) => req.url === '/health'
})

// Skip based on header
const logger = lumnr('combined', {
  skip: (req, res) => req.headers['x-skip-logging'] === 'true'
})
```

---

## Sampling

**Log only a percentage of requests:**

```typescript
// Log 10% of requests (random sampling)
const logger = lumnr('combined', {
  sample: 0.1
})

// Implementation
if (Math.random() > options.sample) {
  return next()  // Skip this request
}
```

**Use cases:**
- High-traffic production (reduce costs)
- Development (reduce noise)
- Load testing (reduce overhead)

---

## Request IDs

**Automatic request ID generation:**

```typescript
const logger = lumnr('combined', {
  includeRequestId: true
})

// Generated with crypto.randomUUID()
// Added to:
// 1. Request context
// 2. Response header (X-Request-ID)
// 3. Log output (if format includes :id)
```

**Custom request ID:**
```typescript
app.use((req, res, next) => {
  req.id = generateCustomId()
  next()
})

const logger = lumnr(':id :method :url :status')
```

---

## Key Principles

1. **Never crash the server** - All errors caught and handled
2. **Zero pollution** - WeakMap instead of req._property
3. **High performance** - Minimal overhead, lazy evaluation
4. **Async-ready** - All operations support async/await
5. **Type-safe** - Full TypeScript support

---

## Performance Targets

**Must beat Pino (17,800 req/s) by 10%+:**

- Target: **19,500+ requests/second**
- Latency: **<1.2ms per request**
- Memory: **<45MB working set**
- Zero memory leaks

**Optimization strategies:**
- Lazy compilation of formats
- WeakMap for O(1) lookups
- Minimal allocations in hot path
- Stream batching (optional)

---

## Testing

**Core system must have 100% coverage:**

```typescript
// Unit tests
describe('Logger Core', () => {
  it('creates logger instance')
  it('handles request/response cycle')
  it('calculates timing accurately')
  it('handles stream errors gracefully')
  it('respects skip function')
  it('supports sampling')
})

// Integration tests
describe('Logger Integration', () => {
  it('works with Express')
  it('works with vanilla http')
  it('handles concurrent requests')
  it('recovers from stream failures')
})
```

---

## Common Patterns

**Pattern: Chaining loggers**
```typescript
// Log all to file
app.use(lumnr('combined', {
  stream: fileStream
}))

// Log errors to console
app.use(lumnr('dev', {
  skip: (req, res) => res.statusCode < 400
}))
```

**Pattern: Conditional formats**
```typescript
const logger = lumnr(
  process.env.NODE_ENV === 'production'
    ? 'json'
    : 'dev'
)
```

**Pattern: Custom middleware wrapper**
```typescript
function createLogger(options) {
  const logger = lumnr('combined', options)

  return (req, res, next) => {
    // Add custom logic before/after
    req.customData = { startTime: Date.now() }
    logger(req, res, next)
  }
}
```
