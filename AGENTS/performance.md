# Performance Optimization

## Overview

Performance is our #1 priority. We must beat Pino (17,800 req/s) by 10%+.

**Target:** 19,500+ requests/second

---

## Performance Budget

| Metric | Target | Pino (current best) |
|--------|--------|---------------------|
| **Throughput** | 19,500+ req/s | 17,800 req/s |
| **Latency** | <1.2ms | 1.3ms |
| **Memory** | <45MB | 48MB |
| **CPU** | <12% | 13% |

---

## Hot Path Optimization

**The hot path runs on EVERY request:**

```typescript
// HOT PATH - optimize aggressively
function logger(req, res, next) {
  const startTime = performance.now()        // ✅ Minimal cost
  requestContext.set(req, { startTime })     // ✅ O(1) WeakMap

  res.on('finish', () => {                   // ✅ One event listener
    const ctx = requestContext.get(req)      // ✅ O(1) lookup
    const line = formatLine(ctx, req, res)   // ⚠️ Format compilation
    stream.write(line + '\n')                // ⚠️ I/O operation
  })

  next()                                     // ✅ Minimal
}
```

**Optimization opportunities:**
1. ✅ Use WeakMap (not object property)
2. ✅ Single event listener (not multiple)
3. ✅ Lazy format compilation (compile once, reuse)
4. ⚠️ Batch writes (optional for high traffic)

---

## Format Compilation

**Compile formats once, reuse forever:**

```typescript
// ❌ BAD: Compile on every request
function formatLine(req, res) {
  const regex = /:method|:url|:status/g
  return format.replace(regex, (match) => {
    return tokens[match.slice(1)](req, res)
  })
}

// ✅ GOOD: Compile once, reuse
const compiledFormats = new Map<string, CompiledFormat>()

function compileFormat(format: string): CompiledFormat {
  if (compiledFormats.has(format)) {
    return compiledFormats.get(format)!
  }

  const parts = parseFormat(format)  // Parse once
  const compiled = (req, res) => {
    return parts.map(p =>
      p.type === 'literal' ? p.value : tokens[p.name](req, res)
    ).join('')
  }

  compiledFormats.set(format, compiled)
  return compiled
}
```

**Performance gain:** 3x faster

---

## Token Caching

**Cache expensive token computations:**

```typescript
// ❌ BAD: Recompute date on every request
tokens.set('date', () => new Date().toISOString())

// ✅ GOOD: Cache date (changes once per second)
const dateCache = new Map<number, string>()

tokens.set('date', () => {
  const second = Math.floor(Date.now() / 1000)

  if (dateCache.has(second)) {
    return dateCache.get(second)!
  }

  const date = new Date().toISOString()
  dateCache.set(second, date)

  // Clean cache after 2 seconds
  setTimeout(() => dateCache.delete(second), 2000)

  return date
})
```

**Performance gain:** 10-100x for date token

---

## Memory Management

**Prevent memory leaks:**

```typescript
// ✅ WeakMap automatically garbage collects
const requestContext = new WeakMap<Request, RequestData>()

// No need to manually delete entries
// When req is GC'd, context is GC'd too

// ❌ BAD: Regular Map leaks memory
const requestContext = new Map<string, RequestData>()
// Must manually delete: requestContext.delete(requestId)
```

**Memory targets:**
- Base: <2MB (empty logger)
- Per request: <500 bytes
- Total working set: <45MB (at 10k concurrent)

---

## String Building

**Avoid string concatenation in hot path:**

```typescript
// ❌ BAD: Creates multiple intermediate strings
const line = method + ' ' + url + ' ' + status + ' ' + time + ' ms'

// ✅ GOOD: Template literal (optimized by V8)
const line = `${method} ${url} ${status} ${time} ms`

// ✅ BEST: Pre-compiled array join
const parts = [method, url, status, `${time} ms`]
const line = parts.join(' ')
```

---

## Batch Writing (Optional)

**For extreme high-traffic scenarios:**

```typescript
class BatchStream {
  private buffer: string[] = []
  private timer: NodeJS.Timeout | null = null
  private readonly batchSize = 100
  private readonly flushInterval = 1000

  write(chunk: string) {
    this.buffer.push(chunk)

    if (this.buffer.length >= this.batchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval)
    }
  }

  private flush() {
    if (this.buffer.length === 0) return

    const data = this.buffer.join('')
    this.stream.write(data)

    this.buffer = []
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
```

**Trade-offs:**
- ✅ Reduces I/O operations (10-100x fewer writes)
- ✅ Better throughput for high traffic
- ⚠️ Delayed logging (up to flushInterval)
- ⚠️ Could lose logs on crash

**Use when:** >50k req/s

---

## Lazy Loading

**Load expensive features only when needed:**

```typescript
// ❌ BAD: Always load, even if never used
import { complexFeature } from './complex-feature.js'

// ✅ GOOD: Load only when needed
let complexFeature: typeof import('./complex-feature') | null = null

async function useComplexFeature() {
  if (!complexFeature) {
    complexFeature = await import('./complex-feature.js')
  }
  return complexFeature.run()
}
```

**Apply to:**
- JSON serialization (only load if jsonOutput: true)
- Data redaction (only load if redact.length > 0)
- Request ID generation (only load if includeRequestId: true)

---

## Benchmarking

**Continuous benchmarking in CI:**

```typescript
// test/benchmarks/throughput.bench.ts
import { bench, describe } from 'vitest'

describe('Logger Throughput', () => {
  bench('lumnr', async () => {
    await testServer(lumnr())
  })

  bench('pino', async () => {
    await testServer(pinoHttp())
  })

  bench('morgan', async () => {
    await testServer(morgan('combined'))
  })
})
```

**Benchmark script:**
```bash
#!/bin/bash
# Run 10k requests, measure throughput

autocannon http://localhost:3000 \
  -c 100 \  # 100 connections
  -d 10 \   # 10 seconds
  -p 10     # 10 pipelined requests
```

**CI Integration:**
```yaml
# .github/workflows/benchmark.yml
- name: Run benchmarks
  run: pnpm bench

- name: Check regression
  run: |
    if [ $THROUGHPUT -lt 19500 ]; then
      echo "Performance regression detected!"
      exit 1
    fi
```

---

## Profiling

**Profile before optimizing:**

```bash
# CPU profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect app.js
# Open Chrome DevTools → Memory → Take heap snapshot

# Flame graphs
node --perf-basic-prof app.js
perf record -F 99 -p $(pgrep node) -g -- sleep 30
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg
```

**What to look for:**
- Hot functions (>5% CPU time)
- Excessive allocations
- GC pauses
- Event loop lag

---

## Optimization Checklist

Before releasing, verify:

- [ ] Beat Pino by 10%+ in benchmarks
- [ ] No memory leaks (heap stable after 1M requests)
- [ ] No GC pauses >10ms
- [ ] Event loop lag <1ms
- [ ] CPU usage comparable to competitors
- [ ] Zero allocations in hot path (where possible)
- [ ] Format compilation cached
- [ ] WeakMap used for request context
- [ ] Lazy loading for optional features

---

## Performance Anti-Patterns

**Avoid these:**

❌ **Creating new objects in hot path**
```typescript
// Bad
const ctx = { startTime: Date.now(), id: uuid() }
```

❌ **Synchronous I/O**
```typescript
// Bad
fs.writeFileSync('log.txt', line)
```

❌ **Regular expressions in hot path**
```typescript
// Bad - compile once instead
const match = /GET|POST|PUT/.exec(method)
```

❌ **try/catch in hot path** (acceptable for top-level)
```typescript
// Avoid in inner loops, ok at middleware level
```

❌ **JSON.stringify on every request** (unless needed)
```typescript
// Only use when jsonOutput: true
```

---

## Performance Testing

**Load test scenarios:**

1. **Sustained load** - 10k req/s for 5 minutes
2. **Burst load** - 50k req/s for 30 seconds
3. **Memory stress** - 1M requests without restart
4. **Concurrent connections** - 10k simultaneous
5. **Large payloads** - Requests with 1MB bodies

**Tools:**
- autocannon (Node.js)
- wrk (C-based, faster)
- k6 (Go-based, scriptable)

---

## Key Metrics to Track

1. **Throughput** - Requests per second
2. **Latency** - p50, p95, p99
3. **Memory** - Heap size, RSS, external
4. **CPU** - Usage percentage
5. **GC** - Pause duration, frequency
6. **Event Loop** - Lag, utilization

---

## Performance Goals by Release

**v0.1 (MVP):**
- Beat Morgan (16,200 req/s)
- <50MB memory

**v0.5 (Beta):**
- Match Pino (17,800 req/s)
- <48MB memory

**v1.0 (Launch):**
- Beat Pino by 10%+ (19,500+ req/s)
- <45MB memory
- Zero memory leaks
- Proven in production

---

## Monitoring Performance

**Add performance metrics to logger:**

```typescript
const logger = lumnr('combined', {
  onStats: (stats) => {
    // Report to monitoring service
    console.log(`Logged ${stats.count} requests in ${stats.duration}ms`)
  }
})
```

**Track:**
- Requests logged per second
- Average log write time
- Format compilation cache hit rate
- Stream errors
