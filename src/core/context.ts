/**
 * Request context management using WeakMap
 * No object pollution - true privacy
 */

import type { Request, RequestData } from '../types.js'
import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'

/**
 * WeakMap for storing request data
 * Automatically garbage collected when request is GC'd
 */
const requestContext = new WeakMap<Request, RequestData>()

/**
 * Create and store request context
 */
export function createContext(
  req: Request,
  options: { includeRequestId?: boolean } = {}
): RequestData {
  const data: RequestData = {
    startTime: performance.now(),
    ...(options.includeRequestId && { id: randomUUID() })
  }

  requestContext.set(req, data)

  return data
}

/**
 * Get request context
 */
export function getContext(req: Request): RequestData | undefined {
  return requestContext.get(req)
}

/**
 * Calculate duration from context
 */
export function getDuration(req: Request): number | undefined {
  const ctx = requestContext.get(req)
  if (!ctx) return undefined

  return performance.now() - ctx.startTime
}

/**
 * Get request ID from context
 */
export function getRequestId(req: Request): string | undefined {
  const ctx = requestContext.get(req)
  return ctx?.id
}
