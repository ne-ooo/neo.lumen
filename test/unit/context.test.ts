import { describe, it, expect } from 'vitest'
import { createContext, getContext, getDuration, getRequestId } from '../../src/core/context.js'
import type { Request } from '../../src/types.js'

function makeReq(): Request {
  return {
    method: 'GET',
    url: '/test',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as Request
}

describe('createContext', () => {
  it('stores a startTime on the request', () => {
    const req = makeReq()
    const ctx = createContext(req)
    expect(typeof ctx.startTime).toBe('number')
    expect(ctx.startTime).toBeGreaterThan(0)
  })

  it('does not include id by default', () => {
    const req = makeReq()
    const ctx = createContext(req)
    expect(ctx.id).toBeUndefined()
  })

  it('includes id when includeRequestId=true', () => {
    const req = makeReq()
    const ctx = createContext(req, { includeRequestId: true })
    expect(typeof ctx.id).toBe('string')
    expect(ctx.id!.length).toBeGreaterThan(0)
  })

  it('generates a UUID-formatted id', () => {
    const req = makeReq()
    const ctx = createContext(req, { includeRequestId: true })
    expect(ctx.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('returns the RequestData object', () => {
    const req = makeReq()
    const ctx = createContext(req)
    expect(ctx).toBeDefined()
    expect(typeof ctx).toBe('object')
  })
})

describe('getContext', () => {
  it('returns undefined for unknown request', () => {
    const req = makeReq()
    expect(getContext(req)).toBeUndefined()
  })

  it('returns the stored context after createContext', () => {
    const req = makeReq()
    const created = createContext(req)
    const retrieved = getContext(req)
    expect(retrieved).toBe(created)
  })

  it('each request has its own context', () => {
    const req1 = makeReq()
    const req2 = makeReq()
    createContext(req1)
    createContext(req2)
    const ctx1 = getContext(req1)
    const ctx2 = getContext(req2)
    expect(ctx1).not.toBe(ctx2)
  })
})

describe('getDuration', () => {
  it('returns undefined when no context', () => {
    const req = makeReq()
    expect(getDuration(req)).toBeUndefined()
  })

  it('returns a non-negative number after createContext', async () => {
    const req = makeReq()
    createContext(req)
    await new Promise((r) => setTimeout(r, 5))
    const duration = getDuration(req)
    expect(typeof duration).toBe('number')
    expect(duration!).toBeGreaterThanOrEqual(0)
  })

  it('increases over time', async () => {
    const req = makeReq()
    createContext(req)
    await new Promise((r) => setTimeout(r, 5))
    const d1 = getDuration(req)!
    await new Promise((r) => setTimeout(r, 5))
    const d2 = getDuration(req)!
    expect(d2).toBeGreaterThan(d1)
  })
})

describe('getRequestId', () => {
  it('returns undefined when no context', () => {
    const req = makeReq()
    expect(getRequestId(req)).toBeUndefined()
  })

  it('returns undefined when context created without id', () => {
    const req = makeReq()
    createContext(req, { includeRequestId: false })
    expect(getRequestId(req)).toBeUndefined()
  })

  it('returns the UUID when context created with id', () => {
    const req = makeReq()
    createContext(req, { includeRequestId: true })
    const id = getRequestId(req)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
