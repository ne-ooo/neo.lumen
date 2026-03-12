# Production Logging with lumen

Best practices for using lumen in production environments.

## Recommended Configuration

```typescript
import { createWriteStream } from 'fs'
import { join } from 'path'
import lumen from '@lpm.dev/neo.lumen'

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// Development: Colored console output
if (isDevelopment) {
  app.use(lumen('dev'))
}

// Production: JSON logs to file with sampling
if (isProduction) {
  const accessLogStream = createWriteStream(
    join(__dirname, '../logs/access.log'),
    { flags: 'a' }
  )

  app.use(lumen('json', {
    stream: accessLogStream,
    includeRequestId: true,
    redact: ['password', 'token', 'apiKey', 'secret', 'authorization'],
    skip: (req, res) => {
      // Don't log health checks
      if (req.url === '/health' || req.url === '/ping') {
        return true
      }
      // Don't log successful static asset requests
      if (req.url.startsWith('/static/') && res.statusCode === 200) {
        return true
      }
      return false
    },
    sample: 1.0 // Log all requests in production
  }))
}
```

## High-Traffic Applications

For applications with very high traffic (>10k req/sec), use sampling:

```typescript
app.use(lumen('json', {
  stream: accessLogStream,
  includeRequestId: true,
  sample: 0.1, // Log 10% of requests
  // Always log errors
  skip: (req, res) => {
    // Never skip errors (status >= 400)
    if (res.statusCode >= 400) {
      return false
    }
    // Sample everything else
    return Math.random() > 0.1
  }
}))
```

## Separate Error Logging

Log errors separately with detailed information:

```typescript
import { createWriteStream } from 'fs'

const accessLog = createWriteStream('./logs/access.log', { flags: 'a' })
const errorLog = createWriteStream('./logs/error.log', { flags: 'a' })

// All requests to access log
app.use(lumen('json', {
  stream: accessLog,
  includeRequestId: true
}))

// Only errors to error log
app.use(lumen('json', {
  stream: errorLog,
  includeRequestId: true,
  skip: (req, res) => res.statusCode < 400
}))
```

## Log Rotation

Use a log rotation library to prevent log files from growing too large:

```typescript
import { createStream } from 'rotating-file-stream'

const accessLog = createStream('access.log', {
  interval: '1d', // Rotate daily
  path: './logs',
  size: '100M', // Rotate when file reaches 100MB
  compress: 'gzip' // Compress rotated files
})

app.use(lumen('json', {
  stream: accessLog,
  includeRequestId: true
}))
```

## Structured Logging for Analytics

Use JSON format for easy parsing and analytics:

```typescript
app.use(lumen('json', {
  includeRequestId: true,
  redact: ['password', 'token', 'authorization']
}))

// Logs will look like:
// {"timestamp":"2024-01-15T10:30:45.123Z","method":"GET","url":"/api/users","status":200,"responseTime":"4.521","contentLength":"1234","requestId":"550e8400-e29b-41d4-a716-446655440000"}
```

Then use tools like:
- **jq** for command-line analysis
- **Elasticsearch** for searching and aggregation
- **CloudWatch/Datadog** for monitoring
- **Grafana** for visualization

## Security Best Practices

Always redact sensitive data:

```typescript
app.use(lumen('json', {
  redact: [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'session',
    'ssn',
    'creditCard',
    'cardNumber'
  ]
}))
```

## Performance Monitoring

Log slow requests for performance monitoring:

```typescript
const SLOW_REQUEST_THRESHOLD = 1000 // 1 second

app.use(lumen('json', {
  stream: createWriteStream('./logs/slow-requests.log', { flags: 'a' }),
  skip: (req, res) => {
    const responseTime = res.getHeader('X-Response-Time')
    if (!responseTime) return true
    return parseFloat(responseTime as string) < SLOW_REQUEST_THRESHOLD
  }
}))
```

## Multi-Environment Setup

```typescript
const logConfig = {
  development: {
    format: 'dev' as const,
    stream: process.stdout,
    includeRequestId: false,
    sample: 1.0
  },
  staging: {
    format: 'json' as const,
    stream: createWriteStream('./logs/access.log', { flags: 'a' }),
    includeRequestId: true,
    redact: ['password', 'token'],
    sample: 0.5 // Log 50% in staging
  },
  production: {
    format: 'json' as const,
    stream: createWriteStream('./logs/access.log', { flags: 'a' }),
    includeRequestId: true,
    redact: ['password', 'token', 'apiKey', 'secret', 'authorization'],
    sample: 0.1, // Log 10% in production
    skip: (req, res) => {
      // Always log errors
      if (res.statusCode >= 400) return false
      // Skip health checks
      if (req.url === '/health') return true
      return false
    }
  }
}

const env = process.env.NODE_ENV || 'development'
app.use(lumen(logConfig[env]))
```

## Custom Request ID

Use your own request ID format:

```typescript
import { randomUUID } from 'crypto'

app.use(lumen('json', {
  includeRequestId: true,
  generateRequestId: () => {
    // Use custom format, e.g., timestamp + random
    return `${Date.now()}-${randomUUID().slice(0, 8)}`
  }
}))
```

## Integration with APM Tools

```typescript
// Example with New Relic
import newrelic from 'newrelic'

app.use(lumen('json', {
  includeRequestId: true,
  generateRequestId: () => {
    // Use APM's trace ID
    return newrelic.getTransaction()?.traceId || randomUUID()
  }
}))
```

## Docker/Kubernetes

For containerized environments, log to stdout with JSON format:

```typescript
// Docker logs to stdout/stderr automatically
app.use(lumen('json', {
  stream: process.stdout,
  includeRequestId: true,
  redact: ['password', 'token']
}))

// Kubernetes can then collect logs from stdout
```

## CloudWatch Integration

```typescript
import { createWriteStream } from 'fs'

// Log to file, CloudWatch agent will pick it up
const accessLog = createWriteStream('/var/log/app/access.log', { flags: 'a' })

app.use(lumen('json', {
  stream: accessLog,
  includeRequestId: true
}))
```

## Summary

**Key Recommendations:**

1. **Use JSON format** in production for structured logging
2. **Enable request IDs** for request tracing
3. **Redact sensitive data** to prevent security leaks
4. **Use sampling** for high-traffic applications
5. **Skip health checks** to reduce noise
6. **Rotate logs** to prevent disk space issues
7. **Log to stdout** in containerized environments
8. **Separate error logs** for easier debugging
9. **Monitor slow requests** for performance issues
10. **Use environment-specific configs** for flexibility
