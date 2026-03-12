/**
 * Output stream handling with error recovery
 */

import type { ErrorHandler, Request, Response } from '../types.js'

/**
 * Write log line to stream with error handling
 */
export async function writeLog(
  stream: NodeJS.WritableStream,
  line: string,
  req: Request,
  res: Response,
  onError?: ErrorHandler
): Promise<void> {
  try {
    stream.write(line + '\n')
  } catch (err) {
    // Never crash the server on logging errors
    if (onError) {
      onError(err as Error, req, res)
    } else {
      // Fallback to stderr
      console.error('[lumen] Logging error:', err)
    }
  }
}
