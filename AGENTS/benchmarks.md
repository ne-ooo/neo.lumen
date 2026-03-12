# Benchmarking System

## Overview

Continuous benchmarking ensures we stay faster than all competitors.

**Goal:** Beat Pino (17,800 req/s) by 10%+ → **19,500+ req/s minimum**

---

## Benchmark Tools

### Primary: Autocannon

**Fast, accurate HTTP benchmarking:**

```bash
autocannon http://localhost:3000 \
  -c 100 \  # 100 concurrent connections
  -d 30 \   # 30 seconds duration
  -p 10     # 10 pipelined requests
```

### Alternative: wrk

**C-based, even faster:**

```bash
wrk -t 12 -c 400 -d 30s http://localhost:3000
```

### For Complex Scenarios: k6

**Scriptable load testing:**

```javascript
import http from 'k6/http'

export default function() {
  http.get('http://localhost:3000/api/users')
}
```

---

## Benchmark Test Servers

### Test Server Template

```typescript
// test/benchmarks/servers/lumnr.ts
import express from 'express'
import lumnr from '../../../src'

const app = express()

app.use(lumnr('combined'))

app.get('/api/users', (req, res) => {
  res.json({ users: [] })
})

export default app
```

### Competitor Servers

```typescript
// test/benchmarks/servers/pino.ts
import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'

const app = express()
app.use(pinoHttp({ logger: pino() }))
app.get('/api/users', (req, res) => res.json({ users: [] }))

export default app

// test/benchmarks/servers/morgan.ts
import express from 'express'
import morgan from 'morgan'

const app = express()
app.use(morgan('combined'))
app.get('/api/users', (req, res) => res.json({ users: [] }))

export default app

// test/benchmarks/servers/winston.ts
// test/benchmarks/servers/bunyan.ts
// etc.
```

---

## Automated Benchmark Suite

```typescript
// test/benchmarks/throughput.bench.ts
import { spawn } from 'child_process'
import { promisify } from 'util'

const sleep = promisify(setTimeout)

interface BenchmarkResult {
  name: string
  reqPerSec: number
  latency: {
    p50: number
    p95: number
    p99: number
  }
  memory: number
  errors: number
}

async function runBenchmark(server: string): Promise<BenchmarkResult> {
  // Start server
  const proc = spawn('node', [`test/benchmarks/servers/${server}.js`])

  await sleep(1000)  // Wait for server to start

  // Run autocannon
  const result = await new Promise((resolve) => {
    spawn('autocannon', [
      'http://localhost:3000',
      '-c', '100',
      '-d', '30',
      '--json'
    ]).stdout.on('data', (data) => {
      resolve(JSON.parse(data.toString()))
    })
  })

  // Kill server
  proc.kill()

  return {
    name: server,
    reqPerSec: result.requests.average,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99
    },
    memory: process.memoryUsage().heapUsed / 1024 / 1024,
    errors: result.errors
  }
}

async function main() {
  const servers = ['lumnr', 'pino', 'morgan', 'winston', 'bunyan']
  const results: BenchmarkResult[] = []

  for (const server of servers) {
    console.log(`Benchmarking ${server}...`)
    const result = await runBenchmark(server)
    results.push(result)
  }

  // Sort by throughput
  results.sort((a, b) => b.reqPerSec - a.reqPerSec)

  // Display results
  console.table(results)

  // Verify lumnr is fastest
  const lumnr = results.find(r => r.name === 'lumnr')!
  const fastest = results[0]

  if (lumnr.reqPerSec < 19500) {
    console.error(`❌ lumnr too slow: ${lumnr.reqPerSec} req/s (target: 19,500+)`)
    process.exit(1)
  }

  if (lumnr !== fastest) {
    console.error(`❌ lumnr not fastest: ${fastest.name} is ${fastest.reqPerSec} req/s`)
    process.exit(1)
  }

  console.log(`✅ lumnr is fastest: ${lumnr.reqPerSec} req/s`)
}

main()
```

---

## CI Integration

```yaml
# .github/workflows/benchmark.yml
name: Benchmarks

on:
  push:
    branches: [main]
  pull_request:

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: pnpm

      - run: pnpm install

      - run: pnpm build

      - name: Run benchmarks
        run: pnpm bench

      - name: Check performance regression
        run: |
          THROUGHPUT=$(cat benchmark-results.json | jq '.lumnr.reqPerSec')
          if (( $(echo "$THROUGHPUT < 19500" | bc -l) )); then
            echo "Performance regression detected!"
            exit 1
          fi

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: benchmark-results.json

      - name: Comment on PR
        uses: actions/github-script@v6
        if: github.event_name == 'pull_request'
        with:
          script: |
            const results = require('./benchmark-results.json')
            const body = `
            ## Benchmark Results

            | Logger | Req/s | p50 | p95 | p99 |
            |--------|-------|-----|-----|-----|
            ${Object.entries(results).map(([name, r]) =>
              `| ${name} | ${r.reqPerSec} | ${r.latency.p50}ms | ${r.latency.p95}ms | ${r.latency.p99}ms |`
            ).join('\n')}

            ${results.lumnr.reqPerSec >= 19500 ? '✅' : '❌'} Performance target: ${results.lumnr.reqPerSec}/19,500 req/s
            `

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            })
```

---

## Performance Targets

| Metric | Target | Current Best (Pino) |
|--------|--------|---------------------|
| **Throughput** | 19,500+ req/s | 17,800 req/s |
| **Latency p50** | <0.5ms | 0.6ms |
| **Latency p95** | <1.5ms | 1.8ms |
| **Latency p99** | <3.0ms | 3.5ms |
| **Memory** | <45MB | 48MB |
| **CPU** | <12% | 13% |

---

## Benchmark Scenarios

### 1. Simple Request

```typescript
app.get('/simple', (req, res) => {
  res.send('OK')
})
```

**Target:** 25,000+ req/s (minimal overhead)

### 2. JSON Response

```typescript
app.get('/json', (req, res) => {
  res.json({ users: [1, 2, 3] })
})
```

**Target:** 20,000+ req/s

### 3. Large Response

```typescript
app.get('/large', (req, res) => {
  const data = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
  res.json(data)
})
```

**Target:** 15,000+ req/s

### 4. Concurrent Connections

```bash
autocannon -c 1000 -d 30 http://localhost:3000
```

**Target:** No degradation >500 concurrent

### 5. Sustained Load

```bash
autocannon -c 100 -d 300 http://localhost:3000  # 5 minutes
```

**Target:** Stable performance, no memory leaks

---

## Memory Benchmarks

```typescript
// test/benchmarks/memory.bench.ts
import { memoryUsage } from 'process'

function measureMemory(fn: () => void, iterations: number) {
  const start = memoryUsage()

  for (let i = 0; i < iterations; i++) {
    fn()
  }

  const end = memoryUsage()

  return {
    heapUsed: (end.heapUsed - start.heapUsed) / iterations,
    external: (end.external - start.external) / iterations
  }
}

const lumnrMemory = measureMemory(() => {
  const logger = lumnr('combined')
  logger(mockReq, mockRes, () => {})
}, 10000)

console.log(`Memory per request: ${lumnrMemory.heapUsed} bytes`)

// Target: <500 bytes per request
if (lumnrMemory.heapUsed > 500) {
  console.error('Memory usage too high!')
  process.exit(1)
}
```

---

## Profiling

### CPU Profiling

```bash
# Generate CPU profile
node --prof app.js

# Process profile
node --prof-process isolate-*.log > profile.txt

# Look for hot functions
cat profile.txt | grep -A 10 "ticks"
```

### Memory Profiling

```bash
# Start with inspector
node --inspect app.js

# Open Chrome DevTools
# Memory → Take heap snapshot
# Compare snapshots before/after 1M requests
```

### Flame Graphs

```bash
# Collect perf data
node --perf-basic-prof app.js &
PID=$!

sleep 5  # Let server warm up

# Record perf data
perf record -F 99 -p $PID -g -- sleep 30

# Generate flame graph
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg

# View in browser
open flame.svg
```

---

## Continuous Monitoring

### Track Performance Over Time

```typescript
// Store benchmark results
const results = {
  date: new Date().toISOString(),
  commit: process.env.GITHUB_SHA,
  throughput: benchmarkResult.reqPerSec,
  latency: benchmarkResult.latency,
  memory: benchmarkResult.memory
}

// Append to history
fs.appendFileSync('benchmark-history.jsonl', JSON.stringify(results) + '\n')

// Check for regression (>5% slower than previous)
const history = fs.readFileSync('benchmark-history.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse)

const previous = history[history.length - 2]

if (results.throughput < previous.throughput * 0.95) {
  console.error('Performance regression detected!')
  console.error(`Previous: ${previous.throughput} req/s`)
  console.error(`Current: ${results.throughput} req/s`)
  process.exit(1)
}
```

---

## Benchmark Reports

### Generate Markdown Report

```typescript
function generateReport(results: BenchmarkResult[]): string {
  return `
# Benchmark Results

**Date:** ${new Date().toISOString()}
**Commit:** ${process.env.GITHUB_SHA}

## Throughput

| Logger | Req/s | vs Pino | vs Target |
|--------|-------|---------|-----------|
${results.map(r => {
  const vsPino = ((r.reqPerSec / 17800 - 1) * 100).toFixed(1)
  const vsTarget = ((r.reqPerSec / 19500 - 1) * 100).toFixed(1)
  return `| ${r.name} | ${r.reqPerSec.toLocaleString()} | ${vsPino > 0 ? '+' : ''}${vsPino}% | ${vsTarget > 0 ? '+' : ''}${vsTarget}% |`
}).join('\n')}

## Latency

| Logger | p50 | p95 | p99 |
|--------|-----|-----|-----|
${results.map(r =>
  `| ${r.name} | ${r.latency.p50}ms | ${r.latency.p95}ms | ${r.latency.p99}ms |`
).join('\n')}

## Memory

| Logger | Heap (MB) | RSS (MB) |
|--------|-----------|----------|
${results.map(r =>
  `| ${r.name} | ${r.memory.heap.toFixed(1)} | ${r.memory.rss.toFixed(1)} |`
).join('\n')}

## Conclusion

${results[0].name === 'lumnr' && results[0].reqPerSec >= 19500
  ? '✅ **lumnr is the fastest and meets performance targets!**'
  : '❌ **Performance targets not met**'
}
  `
}
```

---

## Best Practices

1. **Benchmark early** - Start from day one
2. **Track trends** - Store results over time
3. **Warm up first** - Run 1000 requests before measuring
4. **Multiple runs** - Average of 3+ runs
5. **Consistent environment** - Same hardware, no other load
6. **Real scenarios** - Test actual use cases
7. **Memory leaks** - Test sustained load (1M+ requests)
8. **CI integration** - Fail build on regression

---

## Benchmark Checklist

Before releasing:

- [ ] Beat Pino by 10%+ (19,500+ req/s)
- [ ] Latency p50 < 0.5ms
- [ ] Latency p99 < 3.0ms
- [ ] Memory < 45MB
- [ ] No memory leaks (stable after 1M requests)
- [ ] No performance degradation (sustained load)
- [ ] Benchmarks in CI
- [ ] Results published in docs
