# TypeScript Configuration

## Overview

TypeScript is our source language. We compile to both ESM and CommonJS for maximum compatibility.

**Priority:** Perfect type inference with zero `any` types.

---

## tsconfig.json

```json
{
  "compilerOptions": {
    // Target & Module
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],

    // Strictness (all enabled)
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "importHelpers": false,

    // Interop
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": false,

    // Output
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

---

## Build Configuration (tsup)

**tsup.config.ts:**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,  // Keep readable for debugging
  target: 'node18',
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
      dts: format === 'cjs' ? '.d.cts' : '.d.ts'
    }
  }
})
```

---

## Type Definitions

### Core Types

```typescript
// src/types.ts

import type { IncomingMessage, ServerResponse } from 'node:http'

export type Request = IncomingMessage & {
  originalUrl?: string
  user?: any
  [key: string]: any
}

export type Response = ServerResponse & {
  [key: string]: any
}

export type RequestHandler = (
  req: Request,
  res: Response,
  next: () => void
) => void

export type FormatFn = (
  tokens: TokenMap,
  req: Request,
  res: Response
) => string | undefined

export type TokenFn = (
  req: Request,
  res: Response,
  arg?: string
) => string | undefined

export type SkipFn = (
  req: Request,
  res: Response
) => boolean

export type ErrorHandler = (
  err: Error,
  req: Request,
  res: Response
) => void

export type StatsHandler = (
  stats: LoggerStats
) => void

export interface LumnrOptions {
  // Format
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

  // Callbacks
  onError?: ErrorHandler
  onStats?: StatsHandler
}

export interface LoggerStats {
  count: number
  duration: number
  errors: number
}

export interface TokenMap {
  get(name: string): TokenFn | undefined
  set(name: string, fn: TokenFn): void
  has(name: string): boolean
  keys(): IterableIterator<string>
}

export interface RequestData {
  id?: string
  startTime: number
  metadata?: Record<string, unknown>
}

export interface CompiledFormat {
  (tokens: TokenMap, req: Request, res: Response): string | undefined
}

export interface FormatPart {
  type: 'literal' | 'token'
  value?: string
  name?: string
  arg?: string
}
```

---

## Type Safety Rules

### No `any` Types

```typescript
// ❌ BAD
function process(data: any) {
  return data.value
}

// ✅ GOOD
function process<T>(data: T): T {
  return data
}

// ✅ GOOD (for req/res which are inherently any)
function process(req: Request & { user?: User }): void {
  if (req.user) {
    console.log(req.user.id)  // Typed!
  }
}
```

### Proper Generics

```typescript
// ❌ BAD
function createLogger(options: object) {
  return (req: any, res: any, next: any) => {}
}

// ✅ GOOD
function createLogger(options: LumnrOptions): RequestHandler {
  return (req: Request, res: Response, next: () => void) => {
    // Fully typed
  }
}
```

### Type Inference

```typescript
// ✅ Let TypeScript infer when obvious
const tokens = new Map<string, TokenFn>()  // Explicit generic

tokens.set('method', (req) => req.method)  // Inferred from TokenFn

// ✅ Helper types for inference
type ExtractTokens<T> = T extends TokenMap ? T : never
```

---

## Type Exports

**Export all public types:**

```typescript
// src/index.ts
export type {
  // Options
  LumnrOptions,
  Request,
  Response,
  RequestHandler,

  // Functions
  FormatFn,
  TokenFn,
  SkipFn,
  ErrorHandler,

  // Data structures
  TokenMap,
  LoggerStats
}

export default lumnr
export { token, format, compile }
```

---

## JSDoc for Better DX

**Every public function needs JSDoc:**

```typescript
/**
 * Create a logger middleware
 *
 * @param format - Format string or function (default: 'dev')
 * @param options - Logger options
 * @returns Express-compatible middleware
 *
 * @example
 * ```typescript
 * import lumnr from '@lpm.dev/lpm.lumnr'
 *
 * const logger = lumnr('combined', {
 *   skip: (req, res) => res.statusCode < 400
 * })
 *
 * app.use(logger)
 * ```
 */
export default function lumnr(
  format?: string | FormatFn,
  options?: LumnrOptions
): RequestHandler {
  // Implementation
}
```

---

## Type Testing

**Test types with tsd or vitest:**

```typescript
// test/types.test-d.ts
import { expectType } from 'tsd'
import lumnr, { type LumnrOptions } from '../src'

// Test return type
const logger = lumnr()
expectType<RequestHandler>(logger)

// Test options
const options: LumnrOptions = {
  skip: (req, res) => {
    expectType<Request>(req)
    expectType<Response>(res)
    return true
  },
  stream: process.stdout,
  sample: 0.5
}

// Test custom token
token('user-id', (req, res, arg) => {
  expectType<Request>(req)
  expectType<Response>(res)
  expectType<string | undefined>(arg)
  return 'id'
})
```

---

## Overload Signatures

**For flexible function signatures:**

```typescript
// Overload 1: String format
export default function lumnr(format: string, options?: LumnrOptions): RequestHandler

// Overload 2: Function format
export default function lumnr(format: FormatFn, options?: LumnrOptions): RequestHandler

// Overload 3: Options only
export default function lumnr(options: LumnrOptions): RequestHandler

// Overload 4: No arguments
export default function lumnr(): RequestHandler

// Implementation
export default function lumnr(
  formatOrOptions?: string | FormatFn | LumnrOptions,
  options?: LumnrOptions
): RequestHandler {
  // Implementation handles all cases
}
```

---

## Strict Type Checking

**Enable all strictness flags:**

```json
{
  "compilerOptions": {
    "strict": true,                              // ✅ Enable all strict checks
    "noUncheckedIndexedAccess": true,           // ✅ array[i] is T | undefined
    "exactOptionalPropertyTypes": true,          // ✅ { a?: string } !== { a: string | undefined }
    "noImplicitReturns": true,                  // ✅ All code paths return
    "noFallthroughCasesInSwitch": true,        // ✅ No missing break
    "noUnusedLocals": true,                     // ✅ No unused variables
    "noUnusedParameters": true,                 // ✅ No unused params
    "noImplicitOverride": true,                 // ✅ Explicit override keyword
    "noPropertyAccessFromIndexSignature": true  // ✅ obj.prop vs obj['prop']
  }
}
```

---

## Type Guards

**Use type guards for runtime checking:**

```typescript
function isFormatFn(format: unknown): format is FormatFn {
  return typeof format === 'function'
}

function isLumnrOptions(options: unknown): options is LumnrOptions {
  return typeof options === 'object' && options !== null
}

// Usage
export default function lumnr(
  formatOrOptions?: string | FormatFn | LumnrOptions,
  options?: LumnrOptions
): RequestHandler {
  if (isLumnrOptions(formatOrOptions)) {
    // formatOrOptions is LumnrOptions
    options = formatOrOptions
    formatOrOptions = undefined
  }

  if (isFormatFn(formatOrOptions)) {
    // formatOrOptions is FormatFn
  }
}
```

---

## Utility Types

**Create reusable utility types:**

```typescript
// Make all properties readonly
type ReadonlyDeep<T> = {
  readonly [P in keyof T]: ReadonlyDeep<T[P]>
}

// Extract function parameter types
type Parameters<T> = T extends (...args: infer P) => any ? P : never

// Extract return type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

// Partial but deep
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
```

---

## Type-only Imports

**Import types explicitly:**

```typescript
// ✅ Good - type-only import
import type { LumnrOptions } from './types'

// ❌ Bad - runtime import for types
import { LumnrOptions } from './types'
```

---

## Declaration Files

**Ensure .d.ts files are correct:**

```typescript
// dist/index.d.ts (generated by tsup)
export default function lumnr(
  format?: string | FormatFn,
  options?: LumnrOptions
): RequestHandler

export function token(name: string, fn: TokenFn): typeof lumnr
export function format(name: string, fmt: string | FormatFn): typeof lumnr
export function compile(format: string): FormatFn

export type {
  LumnrOptions,
  Request,
  Response,
  RequestHandler,
  FormatFn,
  TokenFn,
  // ... etc
}
```

---

## IDE Support

**Ensure perfect IDE experience:**

1. **Hover tooltips** - Show full JSDoc
2. **Auto-completion** - Suggest all options
3. **Go to definition** - Jump to source
4. **Find references** - See usage
5. **Rename symbol** - Refactor safely

---

## Type Challenges

**Test complex type scenarios:**

```typescript
// Ensure option properties are correct
const options: LumnrOptions = {
  skip: (req, res) => true,           // ✅ Function
  stream: process.stdout,             // ✅ WritableStream
  sample: 0.5,                        // ✅ Number 0-1
  redact: ['password'],               // ✅ string[]
  includeRequestId: true,             // ✅ boolean
  jsonOutput: true                    // ✅ boolean
}

// Ensure type errors are caught
const bad: LumnrOptions = {
  skip: 'not a function',              // ❌ Error
  sample: 2,                          // ❌ Should warn (>1)
  redact: [123],                      // ❌ Error (not string)
}
```

---

## Best Practices

1. **Zero `any` types** - Use `unknown` and type guards instead
2. **Explicit return types** - For public functions
3. **Generic constraints** - Use `extends` to constrain generics
4. **Type exports** - Export all public types
5. **JSDoc comments** - On all public APIs
6. **Type tests** - Test type inference
7. **Strict mode** - Enable all strict flags
