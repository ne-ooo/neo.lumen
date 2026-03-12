# lumen Examples

Example applications demonstrating lumen usage.

## express-app.ts

A complete Express application showing all major lumen features:

- Basic logging with dev format
- Request ID tracking
- Sensitive data redaction
- Conditional logging (skip function)
- Sampling
- JSON logging
- Custom formats

### Running the Example

```bash
# Install dependencies
npm install express
npm install --save-dev @types/express

# Build lumen first
cd ..
npm run build

# Run the example
cd examples
npx tsx express-app.ts
```

### Testing Endpoints

```bash
# GET requests
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/api/users
curl http://localhost:3000/slow
curl http://localhost:3000/error

# POST requests
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dave","email":"dave@example.com"}'

curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
```

### Configuration Examples

The example file includes commented-out configurations for different use cases:

**Request ID Tracking:**
```typescript
app.use(lumen('dev', {
  includeRequestId: true
}))
```

**Redact Sensitive Data:**
```typescript
app.use(lumen('dev', {
  redact: ['password', 'token', 'apiKey', 'secret']
}))
```

**Only Log Errors:**
```typescript
app.use(lumen('dev', {
  skip: (req, res) => res.statusCode < 400
}))
```

**Sample Requests:**
```typescript
app.use(lumen('dev', {
  sample: 0.1  // Log 10% of requests
}))
```

**JSON Logging:**
```typescript
app.use(lumen('json'))
```

**Custom Format:**
```typescript
app.use(lumen(':method :url :status :response-time ms - :user-agent'))
```

**All Features Combined:**
```typescript
app.use(lumen('dev', {
  includeRequestId: true,
  redact: ['password', 'token'],
  skip: (req, res) => req.url === '/health',
  sample: 1.0
}))
```

## More Examples Coming Soon

- Next.js application
- Fastify application
- Koa application
- Custom tokens example
- Production logging setup
