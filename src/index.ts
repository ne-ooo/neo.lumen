/**
 * lumen - The fastest, most modern HTTP logger for Node.js
 *
 * @module @lpm.dev/neo.lumen
 * @author LPM Team
 * @license MIT
 *
 * @example
 * ```typescript
 * import lumen from '@lpm.dev/neo.lumen'
 * import express from 'express'
 *
 * const app = express()
 *
 * // Use predefined format
 * app.use(lumen('dev'))
 *
 * // Or with options
 * app.use(lumen('combined', {
 *   skip: (req, res) => res.statusCode < 400,
 *   includeRequestId: true
 * }))
 * ```
 */

import type {
  LumnrOptions,
  RequestHandler,
  FormatFn,
  TokenFn,
  CompiledFormat
} from './types.js'
import { createLogger } from './core/logger.js'
import { registerToken } from './formats/tokens.js'
import { registerFormat } from './formats/predefined.js'
import { compileFormat } from './formats/compiler.js'
import { builtInTokens } from './formats/tokens.js'

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create a logger middleware
 *
 * @param format - Format string, function, or options object
 * @param options - Logger options
 * @returns Express/Connect middleware function
 *
 * @example
 * ```typescript
 * // Predefined format
 * app.use(lumen('combined'))
 *
 * // Custom format string
 * app.use(lumen(':method :url :status :response-time ms'))
 *
 * // Custom format function
 * app.use(lumen((tokens, req, res) => {
 *   return `${tokens.method(req, res)} ${tokens.url(req, res)}`
 * }))
 *
 * // With options
 * app.use(lumen('dev', {
 *   skip: (req, res) => res.statusCode < 400,
 *   includeRequestId: true,
 *   redact: ['password', 'token']
 * }))
 * ```
 */
export default function lumen(
  format?: string | FormatFn | LumnrOptions,
  options?: LumnrOptions
): RequestHandler {
  // Handle options-first syntax (for backwards compatibility if needed)
  if (typeof format === 'object' && !options) {
    options = format
    format = options.format || 'dev'
  }

  // Default format
  if (!format) {
    format = 'dev'
  }

  return createLogger(format as string | FormatFn, options || {})
}

// ============================================================================
// Named Exports
// ============================================================================

/**
 * Register a custom token
 *
 * @param name - Token name (without colon)
 * @param fn - Token function
 * @returns lumen function for chaining
 *
 * @example
 * ```typescript
 * import { token } from '@lpm.dev/neo.lumen'
 *
 * token('user-id', (req) => req.user?.id || '-')
 *
 * app.use(lumen(':user-id :method :url :status'))
 * ```
 */
export function token(name: string, fn: TokenFn): typeof lumen {
  registerToken(name, fn)
  return lumen
}

/**
 * Register a custom format
 *
 * @param name - Format name
 * @param fmt - Format string or function
 * @returns lumen function for chaining
 *
 * @example
 * ```typescript
 * import { format } from '@lpm.dev/neo.lumen'
 *
 * format('custom', ':method :url :status :response-time ms')
 *
 * app.use(lumen('custom'))
 * ```
 */
export function format(name: string, fmt: string | FormatFn): typeof lumen {
  registerFormat(name, fmt)
  return lumen
}

/**
 * Compile a format string into a function
 *
 * @param formatStr - Format string to compile
 * @returns Compiled format function
 *
 * @example
 * ```typescript
 * import { compile } from '@lpm.dev/neo.lumen'
 *
 * const formatFn = compile(':method :url :status')
 * const line = formatFn(tokens, req, res)
 * ```
 */
export function compile(formatStr: string): CompiledFormat {
  return compileFormat(formatStr, builtInTokens)
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Configuration
  LumnrOptions,

  // Request/Response
  Request,
  Response,
  RequestHandler,

  // Formats
  FormatFn,
  TokenFn,
  CompiledFormat,
  TokenMap,
  FormatPart,

  // Functions
  SkipFn,
  ErrorHandler,
  StatsHandler,

  // Data
  RequestData,
  LoggerStats
} from './types.js'
