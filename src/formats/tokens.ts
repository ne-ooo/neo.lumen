/**
 * Built-in tokens
 */

import type { TokenFn, TokenMap, Request, Response } from '../types.js'
import { getDuration, getRequestId } from '../core/context.js'

/**
 * Token registry using Map
 */
const tokens = new Map<string, TokenFn>()

/**
 * Date cache (changes once per second)
 */
const dateCache = new Map<string, string>()

/**
 * Format CLF date: 17/Feb/2026:10:30:45 +0000
 */
function formatCLFDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = months[date.getUTCMonth()]!
  const year = date.getUTCFullYear()
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const mins = String(date.getUTCMinutes()).padStart(2, '0')
  const secs = String(date.getUTCSeconds()).padStart(2, '0')

  return `${day}/${month}/${year}:${hour}:${mins}:${secs} +0000`
}

// ============================================================================
// Request Tokens
// ============================================================================

tokens.set('method', (req: Request) => {
  return req.method
})

tokens.set('url', (req: Request) => {
  return req.originalUrl || req.url
})

tokens.set('http-version', (req: Request) => {
  return `${req.httpVersionMajor}.${req.httpVersionMinor}`
})

tokens.set('remote-addr', (req: Request) => {
  return (req as any).ip ||
    req.socket?.remoteAddress ||
    undefined
})

tokens.set('user-agent', (req: Request) => {
  return req.headers['user-agent']
})

tokens.set('referrer', (req: Request) => {
  const value = req.headers['referer'] || req.headers['referrer']
  return Array.isArray(value) ? value.join(', ') : value
})

tokens.set('req', (req: Request, _res: Response, field?: string) => {
  if (!field) return undefined

  const header = req.headers[field.toLowerCase()]
  return Array.isArray(header) ? header.join(', ') : header
})

// ============================================================================
// Response Tokens
// ============================================================================

tokens.set('status', (_req: Request, res: Response) => {
  return res.headersSent ? String(res.statusCode) : undefined
})

tokens.set('res', (_req: Request, res: Response, field?: string) => {
  if (!field || !res.headersSent) return undefined

  const header = res.getHeader(field)
  if (header === undefined) return undefined

  return Array.isArray(header) ? header.join(', ') : String(header)
})

// ============================================================================
// Timing Tokens
// ============================================================================

tokens.set('response-time', (req: Request, _res: Response, digits = '3') => {
  const duration = getDuration(req)
  if (duration === undefined) return undefined

  return duration.toFixed(parseInt(digits, 10))
})

tokens.set('total-time', (req: Request, _res: Response, digits = '3') => {
  // For now, same as response-time
  // Could track total time including post-response processing
  const duration = getDuration(req)
  if (duration === undefined) return undefined

  return duration.toFixed(parseInt(digits, 10))
})

// ============================================================================
// Metadata Tokens
// ============================================================================

tokens.set('date', (_req: Request, _res: Response, format = 'web') => {
  const second = Math.floor(Date.now() / 1000)
  const cacheKey = `${format}-${second}`

  if (dateCache.has(cacheKey)) {
    return dateCache.get(cacheKey)!
  }

  const date = new Date()
  let formatted: string

  switch (format) {
    case 'clf':
      formatted = formatCLFDate(date)
      break
    case 'iso':
      formatted = date.toISOString()
      break
    case 'web':
    default:
      formatted = date.toUTCString()
  }

  dateCache.set(cacheKey, formatted)

  // Clean cache after 2 seconds
  setTimeout(() => dateCache.delete(cacheKey), 2000)

  return formatted
})

tokens.set('id', (req: Request) => {
  return getRequestId(req)
})

// ============================================================================
// Auth Tokens
// ============================================================================

tokens.set('remote-user', (req: Request) => {
  const auth = req.headers['authorization']
  if (!auth || typeof auth !== 'string') return undefined

  // Parse Basic auth: "Basic <base64(user:pass)>"
  const match = auth.match(/^Basic\s+(.+)$/i)
  if (!match?.[1]) return undefined

  const decoded = Buffer.from(match[1], 'base64').toString('utf-8')
  const colonIndex = decoded.indexOf(':')

  // username is everything before the first colon
  return colonIndex === -1 ? decoded : decoded.slice(0, colonIndex) || undefined
})

// ============================================================================
// Export
// ============================================================================

export const builtInTokens: TokenMap = tokens

/**
 * Register a custom token
 */
export function registerToken(name: string, fn: TokenFn): void {
  tokens.set(name, fn)
}

/**
 * Get token function
 */
export function getToken(name: string): TokenFn | undefined {
  return tokens.get(name)
}

/**
 * Check if token exists
 */
export function hasToken(name: string): boolean {
  return tokens.has(name)
}
