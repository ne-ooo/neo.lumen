# lumen 💡

> Illuminate every request

Modern, zero-dependency HTTP request logging middleware for Node.js.

## Features

- ⚡ **Zero dependencies** - Lightweight and secure
- 🚀 **Fast** - ~725,000 req/sec (~1.4μs overhead per request)
- 🎨 **Multiple formats** - dev, tiny, json, combined, or custom
- 🔒 **Type-safe** - Written in strict TypeScript
- 🎯 **Request ID** - Built-in UUID generation
- 🔐 **Redaction** - Automatically mask sensitive data
- 📊 **Sampling** - Log percentage of requests
- 🎮 **Conditional** - Skip logging based on custom logic
- 🌐 **Universal** - ESM + CommonJS support

## Installation

```bash
lpm install @lpm.dev/neo.lumen
```

## Quick Start

```typescript
import express from "express";
import lumen from "@lpm.dev/neo.lumen";

const app = express();

// Use default 'dev' format
app.use(lumen());

// Or specify a format
app.use(lumen("tiny"));

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(3000);
```

**Output:**

```
GET / 200 2.458 ms - 11
POST /api/users 201 45.123 ms - 156
```

---

## Formats

### Predefined Formats

#### `dev` (default)

Colored output for development:

```
GET /api/users 200 4.521 ms - 1234
```

#### `tiny`

Minimal output:

```
GET /api/users 200 1234 - 4.521 ms
```

#### `json`

Structured JSON logs:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "method": "GET",
  "url": "/api/users",
  "status": 200,
  "responseTime": "4.521",
  "contentLength": "1234"
}
```

#### `combined`

Apache combined log format:

```
127.0.0.1 - - [15/Jan/2024:10:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234
```

### Custom Formats

Create custom formats using tokens:

```typescript
app.use(lumen(":method :url :status :response-time ms"));
// Output: GET /api/users 200 4.521 ms
```

### Available Tokens

| Token                    | Description         | Example                                |
| ------------------------ | ------------------- | -------------------------------------- |
| `:method`                | HTTP method         | `GET`                                  |
| `:url`                   | Request URL         | `/api/users`                           |
| `:status`                | Response status     | `200`                                  |
| `:response-time[digits]` | Response time in ms | `4.521`                                |
| `:date[format]`          | Date/time           | `15/Jan/2024:10:30:45 +0000`           |
| `:req[header]`           | Request header      | `:req[user-agent]`                     |
| `:res[header]`           | Response header     | `:res[content-length]`                 |
| `:http-version`          | HTTP version        | `1.1`                                  |
| `:remote-addr`           | Client IP           | `127.0.0.1`                            |
| `:user-agent`            | User agent          | `Mozilla/5.0...`                       |
| `:referrer`              | Referrer            | `https://example.com`                  |
| `:id`                    | Request ID          | `550e8400-e29b-41d4-a716-446655440000` |

---

## Options

```typescript
interface LumnrOptions {
  // Output stream (default: process.stdout)
  stream?: NodeJS.WritableStream;

  // Log immediately on request start instead of finish
  immediate?: boolean;

  // Skip logging based on condition
  skip?: (req: Request, res: Response) => boolean;

  // Sample rate (0-1), e.g., 0.1 = log 10% of requests
  sample?: number;

  // Redact sensitive data
  redact?: string[];

  // Include request ID header (X-Request-ID)
  includeRequestId?: boolean;

  // Custom request ID generator
  generateRequestId?: () => string;
}
```

---

## Examples

### Request ID Tracking

```typescript
app.use(
  lumen("dev", {
    includeRequestId: true,
  }),
);

// Each request gets a unique ID in the X-Request-ID header
```

### Redact Sensitive Data

```typescript
app.use(
  lumen("dev", {
    redact: ["password", "token", "apiKey", "secret"],
  }),
);

// Input:  GET /login?password=secret123&email=user@example.com
// Output: GET /login?password=***REDACTED***&email=user@example.com
```

### Conditional Logging

```typescript
// Only log errors
app.use(
  lumen("dev", {
    skip: (req, res) => res.statusCode < 400,
  }),
);

// Only log slow requests
app.use(
  lumen("dev", {
    skip: (req, res) => {
      const duration = res.getHeader("X-Response-Time");
      return duration && parseFloat(duration as string) < 100;
    },
  }),
);
```

### Sampling

```typescript
// Log only 10% of requests (for high-traffic apps)
app.use(
  lumen("dev", {
    sample: 0.1,
  }),
);
```

### Custom Stream

```typescript
import { createWriteStream } from "fs";

const logStream = createWriteStream("./access.log", { flags: "a" });

app.use(
  lumen("combined", {
    stream: logStream,
  }),
);
```

### Custom Tokens

```typescript
import lumen from "@lpm.dev/neo.lumen";

// Add custom token
lumen.token("custom-header", (req, res) => {
  return req.headers["x-custom-header"] || "-";
});

// Use in format
app.use(lumen(":method :url :custom-header"));
```

---

## Performance

**lumen is the fastest HTTP logger for Node.js:**

### Real HTTP Server Benchmarks (autocannon)

| Logger                | Req/sec    | vs Baseline | Winner |
| --------------------- | ---------- | ----------- | ------ |
| Baseline (no logging) | 52,169     | 100.0%      | -      |
| **lumen dev**         | **44,012** | **84.4%**   | 🥇     |
| **lumen json**        | **39,155** | **75.1%**   | 🥈     |
| pino (extreme)        | 24,920     | 47.8%       | 🥉     |
| morgan (dev)          | 10,509     | 20.1%       | -      |

**Results:**

- **4.2x faster than morgan** (44k vs 10.5k req/sec)
- **1.77x faster than pino** (44k vs 24.9k req/sec)
- Only **15.6% overhead** (vs pino's 52.2%, morgan's 79.9%)
- **Excellent latency**: p50=1ms, p99=4ms

See [BENCHMARKS.md](./BENCHMARKS.md) for detailed analysis.

### Run Benchmarks Yourself

```bash
npm run bench:compare  # Real HTTP server benchmarks
npm run bench          # Micro-benchmarks
```

---

## Development

### Setup

```bash
cd lumen
pnpm install
```

### Build

```bash
pnpm build        # Build for production
pnpm dev          # Watch mode
```

### Test

```bash
pnpm test         # Run tests
pnpm test:watch   # Watch mode
pnpm test:coverage # With coverage
```

### Benchmark

```bash
pnpm bench        # Run benchmarks
```

---

## Migration from Morgan

lumen is API-compatible with morgan for basic usage:

```typescript
// Morgan
import morgan from "morgan";
app.use(morgan("dev"));

// lumen
import lumen from "@lpm.dev/neo.lumen";
app.use(lumen("dev"));
```

**Differences:**

- Zero dependencies (morgan has 9 dependencies)
- Faster performance
- Better TypeScript support
- Additional features (request ID, redaction, sampling)
- ESM-first with CommonJS support

---

## TypeScript

Full TypeScript support with strict types:

```typescript
import lumen, { LumnrOptions, Request, Response } from "@lpm.dev/neo.lumen";

const options: LumnrOptions = {
  skip: (req: Request, res: Response) => res.statusCode < 400,
  redact: ["password"],
  includeRequestId: true,
};

app.use(lumen("dev", options));
```

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run benchmarks
npm run bench
```

---

## Security

- **Zero dependencies** - No risk from vulnerable dependencies
- **Redaction support** - Automatically mask sensitive data
- **Safe compilation** - No eval() or Function() constructor
- **Strict TypeScript** - Catch errors at compile time

---

## License

MIT
