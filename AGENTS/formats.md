# Formats & Tokens

## Overview

The format system compiles format strings into fast functions that extract data from requests/responses.

**Location:** `lumnr/src/formats/`

---

## Format Types

### 1. String Formats

**Use token syntax:**

```typescript
const logger = lumnr(':method :url :status :response-time ms')

// Output: GET /api/users 200 12.345 ms
```

**Token syntax:**
- `:token-name` - Basic token
- `:token-name[arg]` - Token with argument
- Everything else is literal text

### 2. Function Formats

**Custom format function:**

```typescript
const logger = lumnr((tokens, req, res) => {
  return `${tokens.method(req, res)} ${tokens.url(req, res)} ${tokens.status(req, res)}`
})
```

### 3. Predefined Formats

**Built-in formats:**

```typescript
// Apache combined
lumnr('combined')

// Development (colored)
lumnr('dev')

// JSON structured
lumnr('json')

// Minimal
lumnr('tiny')
```

---

## Built-in Tokens

### Request Tokens

| Token | Output | Example |
|-------|--------|---------|
| `:method` | HTTP method | `GET` |
| `:url` | Request URL | `/api/users` |
| `:http-version` | HTTP version | `1.1` |
| `:remote-addr` | Client IP | `192.168.1.1` |
| `:user-agent` | User agent | `curl/8.0` |
| `:referrer` | Referrer header | `https://example.com` |
| `:req[header]` | Request header | `:req[authorization]` |

### Response Tokens

| Token | Output | Example |
|-------|--------|---------|
| `:status` | Status code | `200` |
| `:res[header]` | Response header | `:res[content-length]` |

### Timing Tokens

| Token | Output | Example |
|-------|--------|---------|
| `:response-time` | Response time (ms) | `12.345` |
| `:response-time[0]` | No decimal places | `12` |
| `:total-time` | Total time | `15.678` |

### Metadata Tokens

| Token | Output | Example |
|-------|--------|---------|
| `:date` | Current date (web format) | `Tue, 17 Feb 2026 10:30:45 GMT` |
| `:date[clf]` | CLF date format | `17/Feb/2026:10:30:45 +0000` |
| `:date[iso]` | ISO 8601 format | `2026-02-17T10:30:45.123Z` |
| `:id` | Request ID | `550e8400-e29b-41d4-a716-446655440000` |

---

## Format Compilation

**Formats are compiled once and cached:**

```typescript
// Input format string
const format = ':method :url :status'

// Parsed into parts
const parts = [
  { type: 'token', name: 'method' },
  { type: 'literal', value: ' ' },
  { type: 'token', name: 'url' },
  { type: 'literal', value: ' ' },
  { type: 'token', name: 'status' }
]

// Compiled into fast function
const compiled = (tokens, req, res) => {
  return parts.map(part =>
    part.type === 'literal'
      ? part.value
      : tokens.get(part.name)(req, res)
  ).join('')
}

// Cached for reuse
compiledFormats.set(format, compiled)
```

**Performance:** Compiled formats are 3x faster than runtime parsing.

---

## Token Registration

**Custom tokens:**

```typescript
import { token } from '@lpm.dev/lpm.lumnr'

// Register custom token
token('user-id', (req) => {
  return req.user?.id || '-'
})

// Use in format
const logger = lumnr(':user-id :method :url :status')
```

**Token with arguments:**

```typescript
token('header', (req, res, name) => {
  return req.headers[name.toLowerCase()] || '-'
})

// Usage: :header[authorization]
```

---

## Predefined Formats

### combined (Apache Combined Log Format)

```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Output:**
```
::1 - - [17/Feb/2026:10:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "curl/8.0"
```

### dev (Development - Colored)

```typescript
function dev(tokens, req, res) {
  const status = tokens.status(req, res)
  const color = getStatusColor(status)

  return `${tokens.method(req, res)} ${tokens.url(req, res)} ${colorize(status, color)} ${tokens['response-time'](req, res)} ms`
}
```

**Output (colored):**
```
GET /api/users 200 12.345 ms
```

### json (Structured Logging)

```typescript
function json(tokens, req, res) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: tokens.status(req, res),
    responseTime: tokens['response-time'](req, res),
    userAgent: tokens['user-agent'](req, res)
  })
}
```

**Output:**
```json
{"timestamp":"2026-02-17T10:30:45.123Z","method":"GET","url":"/api/users","status":"200","responseTime":"12.345","userAgent":"curl/8.0"}
```

### tiny (Minimal)

```
:method :url :status :res[content-length] - :response-time ms
```

**Output:**
```
GET /api/users 200 1234 - 12.345 ms
```

---

## Format Examples

### Basic HTTP Log

```typescript
const logger = lumnr(':method :url :status')
// GET /api/users 200
```

### With Timing

```typescript
const logger = lumnr(':method :url :status :response-time ms')
// GET /api/users 200 12.345 ms
```

### With Request ID

```typescript
const logger = lumnr(':id :method :url :status', {
  includeRequestId: true
})
// 550e8400-e29b-41d4-a716-446655440000 GET /api/users 200
```

### Custom Format Function

```typescript
const logger = lumnr((tokens, req, res) => {
  const duration = tokens['response-time'](req, res)
  const isSlow = parseFloat(duration) > 1000

  return `${tokens.method(req, res)} ${tokens.url(req, res)} ${
    isSlow ? '🐌 SLOW' : '⚡ FAST'
  } ${duration}ms`
})
```

---

## Token Implementation

**Token storage (Map):**

```typescript
const tokens = new Map<string, TokenFn>()

type TokenFn = (req: Request, res: Response, arg?: string) => string | undefined
```

**Example token:**

```typescript
tokens.set('method', (req, res) => {
  return req.method
})

tokens.set('url', (req, res) => {
  return req.originalUrl || req.url
})

tokens.set('status', (req, res) => {
  return res.headersSent ? String(res.statusCode) : undefined
})
```

**Token with argument:**

```typescript
tokens.set('response-time', (req, res, digits = '3') => {
  const ctx = requestContext.get(req)
  if (!ctx) return undefined

  const ms = performance.now() - ctx.startTime
  return ms.toFixed(parseInt(digits, 10))
})

// Usage:
// :response-time     → "12.345"
// :response-time[0]  → "12"
// :response-time[6]  → "12.345000"
```

---

## Format Validation

**Validate formats at compile time:**

```typescript
function compileFormat(format: string): CompiledFormat {
  const parts = parseFormat(format)

  // Validate all tokens exist
  for (const part of parts) {
    if (part.type === 'token' && !tokens.has(part.name)) {
      throw new Error(
        `Unknown token ':${part.name}'. Available tokens: ${Array.from(tokens.keys()).map(t => `:${t}`).join(', ')}`
      )
    }
  }

  return createCompiledFunction(parts)
}
```

---

## Safe Compilation (No eval/Function constructor)

**❌ Old morgan approach (UNSAFE):**

```javascript
// DON'T DO THIS
const js = 'return "' + format.replace(/:(\\w+)/g, '" + tokens.$1 + "') + '"'
return new Function('tokens, req, res', js)
```

**✅ Our approach (SAFE):**

```typescript
function compileFormat(format: string): CompiledFormat {
  const parts = parseFormat(format)

  return (tokens, req, res) => {
    return parts.map(part => {
      if (part.type === 'literal') return part.value

      const tokenFn = tokens.get(part.name)
      if (!tokenFn) return '-'

      return tokenFn(req, res, part.arg) || '-'
    }).join('')
  }
}
```

**Benefits:**
- ✅ No security risk
- ✅ Better V8 optimization
- ✅ More debuggable
- ✅ Can be tree-shaken

---

## Color Support

**Terminal colors for dev format:**

```typescript
import { colors } from '@lpm.dev/lpm.colors'  // Our color package

function getStatusColor(status: number): string {
  if (status >= 500) return 'red'
  if (status >= 400) return 'yellow'
  if (status >= 300) return 'cyan'
  if (status >= 200) return 'green'
  return 'reset'
}

function colorize(text: string, color: string): string {
  return colors[color](text)
}
```

**Respects NO_COLOR environment variable.**

---

## Date Formatting

**Three date formats:**

```typescript
tokens.set('date', (req, res, format = 'web') => {
  const date = new Date()

  switch (format) {
    case 'clf':
      // Common Log Format: 17/Feb/2026:10:30:45 +0000
      return formatCLFDate(date)

    case 'iso':
      // ISO 8601: 2026-02-17T10:30:45.123Z
      return date.toISOString()

    case 'web':
    default:
      // RFC 1123: Tue, 17 Feb 2026 10:30:45 GMT
      return date.toUTCString()
  }
})
```

**Cached for performance (changes once per second).**

---

## Format Testing

**Test all formats:**

```typescript
describe('Formats', () => {
  it('combined format', () => {
    const line = formatLine(mockReq, mockRes)
    expect(line).toMatch(/GET \/api\/users 200/)
  })

  it('json format', () => {
    const line = formatLine(mockReq, mockRes)
    const parsed = JSON.parse(line)
    expect(parsed.method).toBe('GET')
  })

  it('custom format', () => {
    const line = formatLine(mockReq, mockRes)
    expect(line).toBe('GET /api/users 200 12.345 ms')
  })
})
```

---

## Best Practices

1. **Cache compiled formats** - Don't recompile on every request
2. **Validate tokens early** - Fail fast on unknown tokens
3. **Use safe compilation** - No eval or Function constructor
4. **Cache expensive tokens** - Like date (changes once per second)
5. **Lazy load colors** - Only if format uses colors
6. **Test all formats** - Ensure output matches expected
7. **Document custom tokens** - Clear examples for users
