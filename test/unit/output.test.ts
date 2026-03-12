import { describe, it, expect, vi } from 'vitest'
import { writeLog } from '../../src/core/output.js'
import { Writable } from 'node:stream'
import type { Request, Response } from '../../src/types.js'

function makeReq(): Request {
  return { method: 'GET', url: '/test', httpVersionMajor: 1, httpVersionMinor: 1, headers: {}, socket: {} } as Request
}
function makeRes(): Response {
  return { statusCode: 200, headersSent: true } as Response
}

function makeStream(collector: string[]): Writable {
  return new Writable({
    write(chunk, _enc, cb) {
      collector.push(chunk.toString())
      cb()
    }
  })
}

describe('writeLog', () => {
  it('writes the line followed by newline to the stream', async () => {
    const written: string[] = []
    const stream = makeStream(written)
    await writeLog(stream, 'GET /test 200', makeReq(), makeRes())
    expect(written).toHaveLength(1)
    expect(written[0]).toBe('GET /test 200\n')
  })

  it('appends newline to every write', async () => {
    const written: string[] = []
    const stream = makeStream(written)
    await writeLog(stream, 'first', makeReq(), makeRes())
    await writeLog(stream, 'second', makeReq(), makeRes())
    expect(written[0]).toMatch(/\n$/)
    expect(written[1]).toMatch(/\n$/)
  })

  it('calls onError when stream.write throws', async () => {
    const broken = new Writable({
      write(_chunk, _enc, cb) {
        cb(new Error('stream exploded'))
      }
    })
    // Force the sync throw path by mocking write
    broken.write = () => { throw new Error('sync throw') }

    const onError = vi.fn()
    const req = makeReq()
    const res = makeRes()
    await writeLog(broken, 'line', req, res, onError)
    expect(onError).toHaveBeenCalledOnce()
    expect((onError.mock.calls[0]![0] as Error).message).toBe('sync throw')
    expect(onError.mock.calls[0]![1]).toBe(req)
    expect(onError.mock.calls[0]![2]).toBe(res)
  })

  it('falls back to console.error when stream throws and no onError provided', async () => {
    const broken = new Writable({ write() {} })
    broken.write = () => { throw new Error('broken stream') }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeLog(broken, 'line', makeReq(), makeRes())
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('writes empty string as just a newline', async () => {
    const written: string[] = []
    const stream = makeStream(written)
    await writeLog(stream, '', makeReq(), makeRes())
    expect(written[0]).toBe('\n')
  })
})
