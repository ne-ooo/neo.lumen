---
name: migrate-from-morgan
description: Migration guide from morgan to neo.lumen — near-drop-in replacement, identical format string syntax, same predefined formats (dev, combined, common, short, tiny), same skip and stream options, built-in features replacing morgan plugins (request IDs, redaction, sampling), plus comparison with pino-http
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Migrating from morgan to @lpm.dev/neo.lumen

## Why Migrate

| | morgan | neo.lumen |
|---|--------|-----------|
| **Performance** | 10.5k req/sec | 44k req/sec (4.2x faster) |
| **Dependencies** | 9 packages | Zero |
| **TypeScript** | Community `@types` | Built-in, strict |
| **ESM** | CommonJS only | ESM + CJS |
| **Request IDs** | Not built-in | Built-in (UUID) |
| **Redaction** | Not built-in | Built-in |
| **Sampling** | Not built-in | Built-in |
| **JSON output** | Manual format function | Built-in `json` format |
| **Maintenance** | Stagnant | Active |

## Drop-In Replacement

```typescript
// Before
import morgan from 'morgan'

app.use(morgan('dev'))
app.use(morgan('combined'))
app.use(morgan(':method :url :status :response-time ms'))

// After — near-identical API
import lumen from '@lpm.dev/neo.lumen'

app.use(lumen('dev'))
app.use(lumen('combined'))
app.use(lumen(':method :url :status :response-time ms'))
```

## Format String Compatibility

lumen uses the same token syntax as morgan. Most format strings work unchanged:

```typescript
// These format strings are identical in morgan and lumen:
':method :url :status :response-time ms'
':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'
':method :url :status :res[content-length] - :response-time ms'
```

### Token Mapping

| morgan token | lumen token | Notes |
|-------------|-------------|-------|
| `:method` | `:method` | Identical |
| `:url` | `:url` | Identical (uses `req.originalUrl`) |
| `:status` | `:status` | Identical |
| `:response-time` | `:response-time` | Identical (ms, 3 decimals default) |
| `:response-time[0]` | `:response-time[0]` | Identical argument syntax |
| `:total-time` | `:total-time` | Identical |
| `:date` | `:date` | Identical (web/clf/iso formats) |
| `:date[clf]` | `:date[clf]` | Identical |
| `:date[iso]` | `:date[iso]` | Identical |
| `:remote-addr` | `:remote-addr` | Identical |
| `:remote-user` | `:remote-user` | Identical (Basic auth) |
| `:http-version` | `:http-version` | Identical |
| `:referrer` | `:referrer` | Identical |
| `:user-agent` | `:user-agent` | Identical |
| `:req[header]` | `:req[header]` | Identical |
| `:res[header]` | `:res[header]` | Identical |
| — | `:id` | **New** — request ID (lumen only) |

## Predefined Format Mapping

| morgan format | lumen format | Output difference |
|--------------|-------------|-------------------|
| `'dev'` | `'dev'` | Same colored output |
| `'combined'` | `'combined'` | Identical Apache format |
| `'common'` | `'common'` | Identical Apache format |
| `'short'` | `'short'` | Identical |
| `'tiny'` | `'tiny'` | Identical |
| — | `'json'` | **New** — structured JSON output |

## Options Mapping

### Stream (Identical)

```typescript
// morgan
app.use(morgan('combined', {
  stream: fs.createWriteStream('/var/log/access.log', { flags: 'a' }),
}))

// lumen — identical
app.use(lumen('combined', {
  stream: fs.createWriteStream('/var/log/access.log', { flags: 'a' }),
}))
```

### Skip (Identical)

```typescript
// morgan
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400,
}))

// lumen — identical
app.use(lumen('combined', {
  skip: (req, res) => res.statusCode < 400,
}))
```

### Immediate (Identical)

```typescript
// morgan
app.use(morgan('combined', { immediate: true }))

// lumen — identical
app.use(lumen('combined', { immediate: true }))
```

## Custom Tokens

```typescript
// morgan
morgan.token('user-id', (req) => req.user?.id || '-')
app.use(morgan(':user-id :method :url :status'))

// lumen — chainable API
lumen.token('user-id', (req) => req.user?.id || '-')
app.use(lumen(':user-id :method :url :status'))

// lumen — chained registration
lumen
  .token('user-id', (req) => req.user?.id || '-')
  .token('tenant', (req) => req.tenant?.name || '-')
```

## Custom Formats

```typescript
// morgan
morgan.format('api', ':date[iso] :method :url :status :response-time ms')
app.use(morgan('api'))

// lumen — identical
lumen.format('api', ':date[iso] :method :url :status :response-time ms')
app.use(lumen('api'))
```

## Built-In Features (No Morgan Equivalent)

### Request IDs

```typescript
// morgan: requires custom middleware + token
// app.use((req, res, next) => { req.id = uuid(); next() })
// morgan.token('id', (req) => req.id)

// lumen: built-in
app.use(lumen(':date[iso] [:id] :method :url :status', {
  includeRequestId: true,
}))
// Sets X-Request-ID response header automatically
```

### Data Redaction

```typescript
// morgan: no built-in support, must manually filter output

// lumen: built-in
app.use(lumen('combined', {
  redact: ['password', 'token', 'apiKey', 'authorization', 'cookie'],
}))
// GET /login?password=secret → GET /login?password=***REDACTED***
```

### Sampling

```typescript
// morgan: must implement in skip function

// lumen: built-in option
app.use(lumen('json', {
  sample: 0.1,  // Log 10% of requests
}))
```

### JSON Output

```typescript
// morgan: requires custom format function
// morgan((tokens, req, res) => JSON.stringify({...}))

// lumen: built-in format
app.use(lumen('json'))
// {"timestamp":"...","method":"GET","url":"/api","status":200,"responseTime":4.521,...}
```

### Error Handling

```typescript
// morgan: no error handling — stream errors can crash the app

// lumen: built-in error handling
app.use(lumen('combined', {
  onError: (err, req, res) => {
    console.error('Logging failed:', err)
  },
}))
// Stream errors are caught — server never crashes due to logging
```

## Coming from pino-http?

pino-http and lumen serve different audiences:

| | lumen | pino-http |
|---|-------|-----------|
| **Philosophy** | Format-string-based, human-readable | Structured JSON, transport pipeline |
| **Setup** | `lumen('dev')` | `pinoHttp({ logger: pino() })` |
| **Dependencies** | 0 | pino ecosystem |
| **Output** | Customizable format strings | Always JSON |
| **Redaction** | Built-in | Requires pino redaction config |
| **Request IDs** | Built-in option | Requires `genReqId` config |

```typescript
// pino-http
import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino({ level: 'info' })
app.use(pinoHttp({ logger }))

// lumen — simpler for HTTP-focused logging
import lumen from '@lpm.dev/neo.lumen'

app.use(lumen('json', { includeRequestId: true }))
```

If you need the full pino ecosystem (transports, log rotation, child loggers, log levels), pino-http is the right choice. If you need fast, simple HTTP logging with built-in features, lumen is lighter and faster.

## Migration Checklist

- [ ] Replace `morgan` import with `@lpm.dev/neo.lumen`
- [ ] Replace `morgan(format)` calls with `lumen(format)` — format strings are compatible
- [ ] Replace `morgan.token()` with `lumen.token()` — same signature
- [ ] Replace `morgan.format()` with `lumen.format()` — same signature
- [ ] Remove custom request ID middleware — use `includeRequestId: true`
- [ ] Remove custom redaction logic — use `redact` option
- [ ] Add `onError` handler for production (morgan doesn't have this)
- [ ] Consider switching to `'json'` format for production log aggregation
- [ ] Remove `morgan` and `@types/morgan` from dependencies
