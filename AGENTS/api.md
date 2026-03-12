# Public API Design

## Overview

The public API must be simple, intuitive, and TypeScript-first.

**Goal:** Better DX than all competitors.

---

## Main Export

```typescript
import lumnr from '@lpm.dev/lpm.lumnr'

// Default export is the factory function
export default lumnr

// Named exports for advanced usage
export { token, format, compile }
```

---

## Factory Function

```typescript
function lumnr(
  format?: string | FormatFn,
  options?: LumnrOptions
): RequestHandler

// Examples:
lumnr()                           // Default format ('dev')
lumnr('combined')                 // Predefined format
lumnr(':method :url :status')     // Custom format string
lumnr(customFn)                   // Custom format function
lumnr('combined', { ... })        // With options
lumnr({ format: 'combined', ... }) // Options-first (deprecated)
```

---

## TypeScript Types

### LumnrOptions

```typescript
interface LumnrOptions {
  // Format configuration
  format?: string | FormatFn
  jsonOutput?: boolean

  // Timing
  immediate?: boolean

  // Filtering
  skip?: SkipFn
  sample?: number

  // Output
  stream?: NodeJS.WritableStream

  // Modern features
  includeRequestId?: boolean
  redact?: string[]

  // Error handling
  onError?: ErrorHandler
  onStats?: StatsHandler
}
```

### FormatFn

```typescript
type FormatFn = (
  tokens: TokenMap,
  req: Request,
  res: Response
) => string | undefined
```

### SkipFn

```typescript
type SkipFn = (req: Request, res: Response) => boolean
```

### ErrorHandler

```typescript
type ErrorHandler = (err: Error, req: Request, res: Response) => void
```

### TokenFn

```typescript
type TokenFn = (req: Request, res: Response, arg?: string) => string | undefined
```

---

## Token API

```typescript
import { token } from '@lpm.dev/lpm.lumnr'

// Register custom token
token(name: string, fn: TokenFn): typeof lumnr

// Example:
token('user-id', (req) => req.user?.id || '-')

// Chainable
token('user-id', ...)
  .token('tenant-id', ...)
  .token('trace-id', ...)
```

---

## Format API

```typescript
import { format } from '@lpm.dev/lpm.lumnr'

// Register custom format
format(name: string, fmt: string | FormatFn): typeof lumnr

// Example:
format('custom', ':method :url :status :response-time ms')

// Or function:
format('custom', (tokens, req, res) => {
  return `${tokens.method(req, res)} ${tokens.url(req, res)}`
})
```

---

## Compile API

```typescript
import { compile } from '@lpm.dev/lpm.lumnr'

// Compile format string to function
compile(format: string): FormatFn

// Example:
const formatFn = compile(':method :url :status')
const line = formatFn(tokens, req, res)
```

---

## Request Handler Type

```typescript
import type { RequestHandler } from 'express'

// lumnr returns an Express-compatible middleware
const logger: RequestHandler = lumnr()

// Or vanilla Node.js:
type NodeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void
```

---

## Usage Examples

### Basic

```typescript
import express from 'express'
import lumnr from '@lpm.dev/lpm.lumnr'

const app = express()

app.use(lumnr('dev'))

app.get('/', (req, res) => {
  res.send('Hello')
})
```

### With Options

```typescript
app.use(lumnr('combined', {
  skip: (req, res) => res.statusCode < 400,
  stream: fs.createWriteStream('./access.log'),
  includeRequestId: true
}))
```

### Custom Format

```typescript
app.use(lumnr(':id :method :url :status :response-time ms', {
  includeRequestId: true
}))
```

### JSON Output

```typescript
app.use(lumnr('combined', {
  jsonOutput: true
}))

// Output: {"timestamp":"...","method":"GET",...}
```

### Sensitive Data Redaction

```typescript
app.use(lumnr('combined', {
  redact: ['password', 'token', 'apiKey']
}))

// GET /login?password=secret123 → GET /login?password=***REDACTED***
```

### Sampling

```typescript
app.use(lumnr('combined', {
  sample: 0.1  // Log 10% of requests
}))
```

### Custom Error Handler

```typescript
app.use(lumnr('combined', {
  onError: (err, req, res) => {
    console.error('[lumnr] Error:', err)
    // Send to error tracking
    errorTracker.captureException(err)
  }
}))
```

### Multiple Loggers

```typescript
// Log all requests to file
app.use(lumnr('combined', {
  stream: fs.createWriteStream('./all.log')
}))

// Log errors to console
app.use(lumnr('dev', {
  skip: (req, res) => res.statusCode < 400
}))
```

---

## Advanced Usage

### Custom Token

```typescript
import { token } from '@lpm.dev/lpm.lumnr'

token('user', (req) => {
  return req.user?.email || 'anonymous'
})

token('tenant', (req) => {
  return req.tenant?.id || '-'
})

app.use(lumnr(':user :tenant :method :url :status'))
```

### Custom Format

```typescript
import { format } from '@lpm.dev/lpm.lumnr'

format('custom', (tokens, req, res) => {
  const duration = parseFloat(tokens['response-time'](req, res) || '0')

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: tokens.status(req, res),
    duration,
    slow: duration > 1000
  })
})

app.use(lumnr('custom'))
```

### Compile Format

```typescript
import { compile } from '@lpm.dev/lpm.lumnr'

const formatFn = compile(':method :url :status')

// Use directly
app.use((req, res, next) => {
  res.on('finish', () => {
    const line = formatFn(tokens, req, res)
    console.log(line)
  })
  next()
})
```

---

## TypeScript Inference

**Perfect auto-completion:**

```typescript
// ✅ Options are fully typed
lumnr('combined', {
  skip: (req, res) => {
    // req and res are fully typed
    return res.statusCode < 400
  },
  stream: process.stdout,  // NodeJS.WritableStream
  sample: 0.5,            // number
  redact: ['password']    // string[]
})

// ✅ Custom token types
token('user-id', (req, res, arg) => {
  // req: Request, res: Response, arg?: string
  return req.user?.id
})

// ✅ Format function types
format('custom', (tokens, req, res) => {
  // tokens: TokenMap, req: Request, res: Response
  return `${req.method} ${req.url}`
})
```

---

## Migration from Other Loggers

### From Morgan

```typescript
// Before (morgan)
import morgan from 'morgan'
app.use(morgan('combined'))

// After (lumnr)
import lumnr from '@lpm.dev/lpm.lumnr'
app.use(lumnr('combined'))
```

**Differences:**
- ✅ Faster performance
- ✅ Better TypeScript support
- ✅ Modern features (request IDs, redaction)
- ⚠️ No buffer option (use batch stream instead)

### From Pino

```typescript
// Before (pino)
import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino()
app.use(pinoHttp({ logger }))

// After (lumnr)
import lumnr from '@lpm.dev/lpm.lumnr'
app.use(lumnr('json'))  // Structured logging
```

**Differences:**
- ✅ Simpler API (no separate logger instance)
- ✅ Better for HTTP logging specifically
- ⚠️ Pino has more general logging features

---

## API Stability

**Semantic Versioning:**

- Patch (1.0.x): Bug fixes, performance improvements
- Minor (1.x.0): New features, backward compatible
- Major (x.0.0): Breaking changes

**Stability Promise:**
- Main API will not break in minor versions
- Deprecated features get 6-month warning
- Migration guides for major versions

---

## Error Messages

**Clear, actionable errors:**

```typescript
// ❌ Bad error
throw new Error('Invalid format')

// ✅ Good error
throw new Error(
  `Invalid format: Unknown token ':${tokenName}'. ` +
  `Available tokens: ${availableTokens.join(', ')}. ` +
  `Did you mean ':${suggestedToken}'?`
)
```

---

## Documentation

**Every public API must have:**
1. TypeScript type definition
2. JSDoc comment
3. Example usage
4. Link to full docs

**Example:**

```typescript
/**
 * Create a logger middleware
 *
 * @param format - Format string or function (default: 'dev')
 * @param options - Logger options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import lumnr from '@lpm.dev/lpm.lumnr'
 *
 * app.use(lumnr('combined'))
 * ```
 *
 * @see https://lumnr.dev/docs/api
 */
export default function lumnr(
  format?: string | FormatFn,
  options?: LumnrOptions
): RequestHandler
```

---

## Backwards Compatibility

**Things we'll never break:**

- ✅ Main factory function signature
- ✅ Built-in format names
- ✅ Built-in token names
- ✅ Core options (skip, stream, etc.)

**Things we might change in major versions:**

- ⚠️ Default format
- ⚠️ Option defaults
- ⚠️ Internal implementation
- ⚠️ Optional features

---

## Best Practices

1. **Keep it simple** - Most users should use `lumnr('dev')` and be done
2. **TypeScript-first** - Types guide the design, not an afterthought
3. **Clear errors** - Help users fix problems quickly
4. **Document everything** - Every option, every token
5. **Stable API** - Don't break things without good reason
6. **Migration guides** - Make upgrades painless
