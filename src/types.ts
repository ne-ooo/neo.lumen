/**
 * Type definitions for lumen
 * @module @lpm.dev/neo.lumen
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

// ============================================================================
// Core Types
// ============================================================================

/**
 * Extended Request type compatible with Express/Connect
 */
export type Request = IncomingMessage & {
  originalUrl?: string
  user?: any
  [key: string]: any
}

/**
 * Extended Response type compatible with Express/Connect
 */
export type Response = ServerResponse & {
  [key: string]: any
}

/**
 * Express/Connect compatible middleware function
 */
export type RequestHandler = (
  req: Request,
  res: Response,
  next: () => void
) => void

// ============================================================================
// Format Types
// ============================================================================

/**
 * Format function that generates log line from request/response
 */
export type FormatFn = (
  tokens: TokenMap,
  req: Request,
  res: Response
) => string | undefined

/**
 * Token function that extracts data from request/response
 */
export type TokenFn = (
  req: Request,
  res: Response,
  arg?: string
) => string | undefined

/**
 * Compiled format function (output of compilation)
 */
export interface CompiledFormat {
  (tokens: TokenMap, req: Request, res: Response): string | undefined
}

/**
 * Token map for looking up token functions
 */
export interface TokenMap {
  get(name: string): TokenFn | undefined
  set(name: string, fn: TokenFn): void
  has(name: string): boolean
  keys(): IterableIterator<string>
}

/**
 * Parsed format part (literal text or token)
 */
export interface FormatPart {
  type: 'literal' | 'token'
  value?: string  // For literal parts
  name?: string   // For token parts
  arg?: string    // Optional token argument
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Skip function to conditionally skip logging
 */
export type SkipFn = (req: Request, res: Response) => boolean

/**
 * Error handler for logging errors
 */
export type ErrorHandler = (err: Error, req: Request, res: Response) => void

/**
 * Stats handler for performance metrics
 */
export type StatsHandler = (stats: LoggerStats) => void

/**
 * Main options for configuring lumen
 */
export interface LumnrOptions {
  // Format configuration
  /** Format string or function (default: 'dev') */
  format?: string | FormatFn
  /** Force JSON output regardless of format */
  jsonOutput?: boolean

  // Timing
  /** Log immediately on request instead of on response */
  immediate?: boolean

  // Filtering
  /** Function to skip logging certain requests */
  skip?: SkipFn
  /** Sample rate (0-1) for logging only a percentage of requests */
  sample?: number

  // Output
  /** Writable stream for log output (default: process.stdout) */
  stream?: NodeJS.WritableStream

  // Modern features
  /** Generate and include request IDs */
  includeRequestId?: boolean
  /** Array of sensitive field patterns to redact */
  redact?: string[]

  // Callbacks
  /** Custom error handler for logging errors */
  onError?: ErrorHandler
  /** Callback for performance statistics */
  onStats?: StatsHandler
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Request context stored in WeakMap
 */
export interface RequestData {
  /** Unique request ID (if enabled) */
  id?: string
  /** Start time from performance.now() */
  startTime: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Logger statistics
 */
export interface LoggerStats {
  /** Number of requests logged */
  count: number
  /** Time period in milliseconds */
  duration: number
  /** Number of logging errors */
  errors: number
}
