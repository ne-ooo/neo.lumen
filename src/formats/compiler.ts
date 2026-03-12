/**
 * Format compilation - safe, no eval/Function constructor
 */

import type { CompiledFormat, FormatPart, TokenMap } from '../types.js'

/**
 * Cache for compiled formats
 */
const compiledFormats = new Map<string, CompiledFormat>()

/**
 * Parse format string into parts
 */
function parseFormat(format: string): FormatPart[] {
  const parts: FormatPart[] = []
  const tokenRegex = /:([a-zA-Z][\w-]*)(?:\[([^\]]+)\])?/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(format)) !== null) {
    // Add literal text before token
    if (match.index > lastIndex) {
      parts.push({
        type: 'literal',
        value: format.slice(lastIndex, match.index)
      })
    }

    // Add token
    parts.push({
      type: 'token',
      name: match[1]!,
      arg: match[2]
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining literal text
  if (lastIndex < format.length) {
    parts.push({
      type: 'literal',
      value: format.slice(lastIndex)
    })
  }

  return parts
}

/**
 * Compile format string into fast function
 * Safe - no eval or Function constructor
 */
export function compileFormat(format: string, tokens: TokenMap): CompiledFormat {
  // Check cache first
  if (compiledFormats.has(format)) {
    return compiledFormats.get(format)!
  }

  // Parse format string
  const parts = parseFormat(format)

  // Validate all tokens exist
  for (const part of parts) {
    if (part.type === 'token' && !tokens.has(part.name!)) {
      const available = Array.from(tokens.keys()).map(t => `:${t}`).join(', ')
      throw new Error(
        `Unknown token ':${part.name}'. Available tokens: ${available}`
      )
    }
  }

  // Create compiled function
  const compiled: CompiledFormat = (tokenMap, req, res) => {
    return parts.map(part => {
      if (part.type === 'literal') {
        return part.value!
      }

      const tokenFn = tokenMap.get(part.name!)
      if (!tokenFn) return '-'

      const value = tokenFn(req, res, part.arg)
      return value !== undefined ? value : '-'
    }).join('')
  }

  // Cache it
  compiledFormats.set(format, compiled)

  return compiled
}

/**
 * Clear format cache (for testing)
 */
export function clearFormatCache(): void {
  compiledFormats.clear()
}
