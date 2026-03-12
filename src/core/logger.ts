/**
 * Core logger implementation
 */

import type {
  LumnrOptions,
  RequestHandler,
  FormatFn,
  Request,
  Response
} from '../types.js'
import { createContext } from './context.js'
import { writeLog } from './output.js'
import { compileFormat } from '../formats/compiler.js'
import { builtInTokens } from '../formats/tokens.js'
import { getFormat } from '../formats/predefined.js'

/**
 * Create logger middleware
 */
export function createLogger(
  format: string | FormatFn = 'dev',
  options: LumnrOptions = {}
): RequestHandler {
  const {
    immediate = false,
    skip = false,
    stream = process.stdout,
    includeRequestId = false,
    redact = [],
    sample = 1.0,
    onError,
    jsonOutput = false
  } = options

  // Determine format function
  let formatFn: FormatFn

  if (typeof format === 'function') {
    // Custom format function
    formatFn = format
  } else {
    // String format - check predefined first
    const predefined = getFormat(format)

    if (typeof predefined === 'function') {
      formatFn = predefined
    } else if (typeof predefined === 'string') {
      formatFn = compileFormat(predefined, builtInTokens)
    } else {
      // Not predefined, try to compile as format string
      try {
        formatFn = compileFormat(format, builtInTokens)
      } catch (err) {
        throw new Error(
          `Invalid format: ${format}. ` +
          `Available formats: ${Array.from(['combined', 'common', 'dev', 'short', 'tiny', 'json']).join(', ')}`
        )
      }
    }
  }

  // Override with JSON format if requested
  if (jsonOutput) {
    const jsonFormat = getFormat('json')
    if (typeof jsonFormat === 'function') {
      formatFn = jsonFormat
    }
  }

  // Return middleware function
  return (req: Request, res: Response, next: () => void) => {
    // Skip based on sampling
    if (sample < 1.0 && Math.random() > sample) {
      return next()
    }

    // Create request context
    const ctx = createContext(req, { includeRequestId })

    // Add request ID to response header if enabled
    if (ctx.id) {
      res.setHeader('X-Request-ID', ctx.id)
    }

    // Log function
    const logRequest = async () => {
      // Skip based on skip function
      if (skip && skip(req, res)) {
        return
      }

      try {
        // Generate log line
        let line = formatFn(builtInTokens, req, res)

        if (!line) return

        // Redact sensitive data
        if (redact.length > 0) {
          line = redactSensitiveData(line, redact)
        }

        // Write to stream
        await writeLog(stream, line, req, res, onError)
      } catch (err) {
        // Handle errors gracefully
        if (onError) {
          onError(err as Error, req, res)
        } else {
          console.error('[lumen] Error generating log:', err)
        }
      }
    }

    if (immediate) {
      // Log immediately
      logRequest().catch(err => {
        console.error('[lumen] Immediate log error:', err)
      })
    } else {
      // Log when response finishes
      res.on('finish', () => {
        logRequest().catch(err => {
          console.error('[lumen] Finish log error:', err)
        })
      })
    }

    next()
  }
}

/**
 * Redact sensitive data from log line
 */
function redactSensitiveData(line: string, patterns: string[]): string {
  let redacted = line

  for (const pattern of patterns) {
    // Match pattern=value or pattern:value or pattern value
    const regex = new RegExp(
      `(${pattern}[=:\\s]+)([^\\s&"']+)`,
      'gi'
    )
    redacted = redacted.replace(regex, '$1***REDACTED***')
  }

  return redacted
}
