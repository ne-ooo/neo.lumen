# @lpm.dev/neo.lumen - Future Enhancements

## Potential Features & Improvements

### 1. Plugin System

**Status**: Not implemented
**Priority**: High
**Effort**: Medium

Allow users to extend functionality:

```typescript
import lumen from "@lpm.dev/neo.lumen";

const geoPlugin = {
  name: "geo-location",
  onRequest: (req) => ({
    country: req.headers["cf-ipcountry"],
    city: req.headers["cf-ipcity"],
  }),
};

const logger = lumen(FORMAT, {
  plugins: [geoPlugin],
});
```

**Benefits**:

- Extensible without bloating core
- Community contributions
- Custom logging needs

**Considerations**:

- Need stable plugin API (~100 LOC)
- Documentation overhead
- Potential performance impact

---

### 2. Structured Logging (JSON mode)

**Status**: Partially implemented (JSON format exists)
**Priority**: High
**Effort**: Low

Enhanced JSON logging with metadata:

```typescript
const logger = lumen("json", {
  structured: true,
  fields: {
    service: "api",
    version: "1.0.0",
    environment: "production",
  },
});

// Outputs:
// {
//   "timestamp": "...",
//   "method": "GET",
//   "path": "/api",
//   "status": 200,
//   "duration": 45,
//   "service": "api",
//   "version": "1.0.0",
//   "environment": "production"
// }
```

**Benefits**:

- Better log aggregation
- Searchable logs
- Cloud-native logging

**Considerations**:

- ~50 LOC addition
- Need to ensure JSON is valid
- May want different JSON schemas

---

### 3. Log Filtering

**Status**: Not implemented
**Priority**: Medium
**Effort**: Low

Filter logs by criteria:

```typescript
const logger = lumen(FORMAT, {
  filter: (req, res) => {
    // Don't log health checks
    if (req.url === "/health") return false;

    // Don't log successful GET requests
    if (req.method === "GET" && res.statusCode < 400) return false;

    return true;
  },
});
```

**Benefits**:

- Reduce log noise
- Save disk space
- Focus on important events

**Considerations**:

- ~30 LOC addition
- Performance impact of filter function
- May want multiple filter levels

---

### 4. Request/Response Body Logging

**Status**: Not implemented
**Priority**: Medium
**Effort**: Medium

Log request/response bodies:

```typescript
const logger = lumen(FORMAT, {
  logBody: true,
  maxBodySize: 1024, // 1KB max
  redactFields: ["password", "token", "apiKey"],
});

// Logs:
// POST /api/users 201 45ms {"email":"user@example.com","password":"[REDACTED]"}
```

**Benefits**:

- Debug API issues
- Audit trail
- Request replay

**Considerations**:

- Privacy concerns (~100 LOC)
- Performance impact (need to buffer body)
- Large bodies can overwhelm logs
- Security: must redact sensitive data

---

### 5. Multiple Output Destinations

**Status**: Not implemented
**Priority**: Medium
**Effort**: Low

Write to multiple streams:

```typescript
const logger = lumen(FORMAT, {
  streams: [
    process.stdout, // Console
    fs.createWriteStream("access.log"), // File
    remoteStream, // Remote logging service
  ],
});
```

**Benefits**:

- Flexible logging
- Archive logs
- Send to monitoring services

**Considerations**:

- ~50 LOC addition
- Error handling for failed streams
- Performance with multiple streams

---

### 6. Log Rotation

**Status**: Not implemented
**Priority**: Low
**Effort**: High

Automatic log file rotation:

```typescript
const logger = lumen(FORMAT, {
  rotation: {
    maxSize: "10MB",
    maxFiles: 5,
    compress: true,
  },
});
```

**Benefits**:

- Prevent disk full
- Automatic cleanup
- Production-ready

**Considerations**:

- Significant complexity (~200-300 LOC)
- File system operations
- Platform-specific behavior
- Better handled by external tools (logrotate)

---

### 7. Sampling

**Status**: Not implemented
**Priority**: Low
**Effort**: Low

Log only a percentage of requests:

```typescript
const logger = lumen(FORMAT, {
  sampleRate: 0.1, // Log 10% of requests
});
```

**Benefits**:

- Reduce log volume in high-traffic apps
- Representative sampling
- Cost savings

**Considerations**:

- ~20 LOC addition
- May miss important events
- Need smart sampling (always log errors)

---

### 8. Rate Limiting

**Status**: Not implemented
**Priority**: Low
**Effort**: Low

Limit log frequency:

```typescript
const logger = lumen(FORMAT, {
  rateLimit: {
    max: 1000, // Max 1000 logs
    window: "1m", // Per minute
  },
});
```

**Benefits**:

- Prevent log flooding
- Protect against attacks
- Resource protection

**Considerations**:

- ~40 LOC addition
- Need to track state
- May drop important logs

---

### 9. Custom Formatters

**Status**: Partially implemented (can pass custom format)
**Priority**: Low
**Effort**: Low

More flexible custom formatters:

```typescript
const logger = lumen({
  format: (req, res, duration) => {
    return `[${new Date().toISOString()}] ${req.method} ${req.url}`;
  },
  color: true, // Apply colors to custom format
});
```

**Benefits**:

- Total control
- Framework compatibility

**Considerations**:

- Already possible with current API
- ~30 LOC to enhance
- Documentation needed

---

### 10. Metric Collection

**Status**: Not implemented
**Priority**: Low
**Effort**: Medium

Collect metrics alongside logging:

```typescript
const logger = lumen(FORMAT, {
  metrics: {
    enabled: true,
    export: "prometheus", // or 'statsd'
  },
});

// Exposes:
// - http_requests_total
// - http_request_duration_seconds
// - http_request_size_bytes
```

**Benefits**:

- Observability
- Performance monitoring
- Production insights

**Considerations**:

- Scope creep (~200 LOC)
- Better as separate package
- Overlaps with APM tools

---

### 11. Correlation IDs

**Status**: Partially implemented (request ID token exists)
**Priority**: Medium
**Effort**: Low

Automatic correlation ID handling:

```typescript
const logger = lumen(FORMAT, {
  correlationId: {
    header: "x-correlation-id", // Read from header
    generate: true, // Generate if missing
    propagate: true, // Add to response header
  },
});
```

**Benefits**:

- Distributed tracing
- Request flow tracking
- Microservices debugging

**Considerations**:

- ~40 LOC addition
- Already have request ID token
- Just need to enhance it

---

### 12. Error Logging

**Status**: Not implemented
**Priority**: Medium
**Effort**: Low

Detailed error logging:

```typescript
const logger = lumen(FORMAT, {
  logErrors: true,
  includeStack: true,
});

// On error, logs:
// POST /api/users 500 45ms
// Error: User validation failed
//   at validateUser (/app/user.js:23:5)
//   ...
```

**Benefits**:

- Better debugging
- Error tracking
- Stack traces in logs

**Considerations**:

- ~50 LOC addition
- May be verbose
- Privacy concerns with stack traces

---

### 13. Integration with Neo.colors

**Status**: Not implemented
**Priority**: High
**Effort**: Low

Use @lpm.dev/neo.colors for colored output:

```typescript
// Currently uses custom color codes
// Future: Use neo.colors package

import colors from "@lpm.dev/neo.colors";
import lumen from "@lpm.dev/neo.lumen";

const logger = lumen(FORMAT, {
  colors: colors, // Use neo.colors
  colorMode: "auto", // or '16', '256', 'truecolor'
});
```

**Benefits**:

- Package synergy
- Better color support
- Consistent coloring across ecosystem

**Considerations**:

- ~50 LOC to integrate
- Adds dependency (but our own)
- Need to maintain backward compatibility

---

## Recommended Priority Order

### High Priority (Consider for v0.2.0)

1. **Plugin System** - Extensibility without bloat
2. **Structured Logging** - Better JSON support
3. **Integration with Neo.colors** - Ecosystem synergy

### Medium Priority (Consider for v1.x)

4. **Log Filtering** - Reduce noise
5. **Correlation IDs** - Enhance existing feature
6. **Request/Response Body Logging** - Common need
7. **Error Logging** - Better debugging
8. **Multiple Output Destinations** - Flexibility

### Low Priority (Consider if requested)

9. Custom Formatters (enhance existing)
10. Sampling
11. Rate Limiting

### Not Recommended

- Log Rotation (use external tools)
- Metric Collection (separate package)

---

## Integration Opportunities

### With Neo.colors

- Use for colored terminal output
- Share color detection logic
- Unified color themes

### With Future Neo packages

- **neo.metrics** - Metrics collection
- **neo.trace** - Distributed tracing
- **neo.config** - Configuration management

---

## Community Feedback

Track feature requests:

- GitHub Issues: User requests
- npm trends: Compare with morgan, pino, winston
- Real-world usage: Monitor how people use lumen

---

## Breaking Changes for v2.0

Future breaking changes to consider:

- Require Node 20+
- Remove deprecated formats
- Simplify API surface
- Merge with metrics package

---

**Last Updated**: 2025-01-15
