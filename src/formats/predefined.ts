/**
 * Predefined log formats
 */

import type { FormatFn, TokenMap, Request, Response } from '../types.js'

/**
 * Predefined formats storage
 */
const formats = new Map<string, string | FormatFn>()

// ============================================================================
// Apache Formats
// ============================================================================

/**
 * Apache Combined Log Format
 */
formats.set(
  'combined',
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
)

/**
 * Apache Common Log Format
 */
formats.set(
  'common',
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'
)

/**
 * Short format with response time
 */
formats.set(
  'short',
  ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'
)

// ============================================================================
// Development Format (with colors)
// ============================================================================

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m'
} as const

/**
 * Check if colors should be disabled
 */
const supportsColor = !process.env.NO_COLOR && process.stdout.isTTY

/**
 * Colorize text based on status code
 */
function colorize(text: string, status: number): string {
  if (!supportsColor) return text

  let color: string
  if (status >= 500) color = colors.red
  else if (status >= 400) color = colors.yellow
  else if (status >= 300) color = colors.cyan
  else if (status >= 200) color = colors.green
  else color = colors.reset

  return `${color}${text}${colors.reset}`
}

/**
 * Development format with colored status
 */
formats.set('dev', function devFormat(tokens: TokenMap, req: Request, res: Response): string {
  const method = tokens.get('method')!(req, res)
  const url = tokens.get('url')!(req, res)
  const statusToken = tokens.get('status')!(req, res)
  const status = statusToken ? parseInt(statusToken, 10) : 0
  const responseTime = tokens.get('response-time')!(req, res)
  const contentLength = tokens.get('res')!(req, res, 'content-length')

  const statusColored = statusToken ? colorize(statusToken, status) : '-'

  return `${method} ${url} ${statusColored} ${responseTime} ms - ${contentLength || '-'}`
})

// ============================================================================
// Minimal Formats
// ============================================================================

/**
 * Tiny format - minimal output
 */
formats.set(
  'tiny',
  ':method :url :status :res[content-length] - :response-time ms'
)

// ============================================================================
// JSON Format
// ============================================================================

/**
 * JSON structured logging
 */
formats.set('json', function jsonFormat(tokens: TokenMap, req: Request, res: Response): string {
  const data: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    method: tokens.get('method')!(req, res),
    url: tokens.get('url')!(req, res),
    status: tokens.get('status')!(req, res),
    responseTime: tokens.get('response-time')!(req, res),
    contentLength: tokens.get('res')!(req, res, 'content-length'),
    userAgent: tokens.get('user-agent')!(req, res),
    remoteAddr: tokens.get('remote-addr')!(req, res)
  }

  // Add request ID if available
  const requestId = tokens.get('id')!(req, res)
  if (requestId) {
    data.requestId = requestId
  }

  return JSON.stringify(data)
})

// ============================================================================
// Export
// ============================================================================

/**
 * Get predefined format
 */
export function getFormat(name: string): string | FormatFn | undefined {
  return formats.get(name)
}

/**
 * Register custom format
 */
export function registerFormat(name: string, fmt: string | FormatFn): void {
  formats.set(name, fmt)
}

/**
 * Check if format exists
 */
export function hasFormat(name: string): boolean {
  return formats.has(name)
}

/**
 * Get all format names
 */
export function getFormatNames(): string[] {
  return Array.from(formats.keys())
}
