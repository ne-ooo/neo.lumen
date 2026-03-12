#!/usr/bin/env node
/**
 * Automated HTTP server benchmark runner
 * Compares lumen, morgan, pino, and baseline
 */

import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import autocannon from 'autocannon'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 3000
const URL = `http://localhost:${PORT}`

interface BenchmarkResult {
  name: string
  requests: {
    average: number
    mean: number
    stddev: number
    min: number
    max: number
    total: number
    sent: number
  }
  latency: {
    mean: number
    stddev: number
    min: number
    max: number
    p50: number
    p75: number
    p90: number
    p99: number
  }
  throughput: {
    average: number
    mean: number
    stddev: number
    min: number
    max: number
    total: number
  }
  errors: number
  timeouts: number
  duration: number
}

/**
 * Start a server and wait for it to be ready
 */
async function startServer(scriptPath: string, env: Record<string, string> = {}): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['--import', 'tsx', scriptPath], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      if (output.includes('running on')) {
        // Wait a bit more to ensure server is fully ready
        setTimeout(() => resolve(proc), 500)
      }
    })

    proc.stderr?.on('data', (data) => {
      console.error('Server error:', data.toString())
    })

    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`))
      }
    })

    // Timeout if server doesn't start in 10 seconds
    setTimeout(() => {
      proc.kill()
      reject(new Error('Server start timeout'))
    }, 10000)
  })
}

/**
 * Stop a server gracefully
 */
async function stopServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    proc.on('exit', () => resolve())
    proc.kill('SIGINT')
    // Force kill after 5 seconds
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL')
      }
      resolve()
    }, 5000)
  })
}

/**
 * Run autocannon benchmark
 */
async function runBenchmark(name: string): Promise<BenchmarkResult> {
  console.log(`\n🏃 Running benchmark: ${name}`)

  const result = await autocannon({
    url: URL,
    connections: 100,
    duration: 10,
    pipelining: 1
  })

  return {
    name,
    requests: result.requests,
    latency: result.latency,
    throughput: result.throughput,
    errors: result.errors,
    timeouts: result.timeouts,
    duration: result.duration
  }
}

/**
 * Run benchmark for a specific server
 */
async function benchmarkServer(
  name: string,
  scriptPath: string,
  env: Record<string, string> = {}
): Promise<BenchmarkResult> {
  let server: ChildProcess | null = null

  try {
    console.log(`\n📊 Starting ${name} server...`)
    server = await startServer(scriptPath, env)

    // Wait a bit for server to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000))

    const result = await runBenchmark(name)

    return result
  } finally {
    if (server) {
      await stopServer(server)
      // Wait between benchmarks
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

/**
 * Format results table
 */
function printResults(results: BenchmarkResult[]) {
  console.log('\n\n' + '='.repeat(100))
  console.log('📊 BENCHMARK RESULTS')
  console.log('='.repeat(100))

  // Find baseline for comparison
  const baseline = results.find(r => r.name.includes('Baseline'))
  const baselineReqSec = baseline?.requests.average || 0

  console.log('\n' + '─'.repeat(100))
  console.log(
    'Name'.padEnd(25) +
    'Req/sec'.padStart(15) +
    'vs Baseline'.padStart(15) +
    'Latency p50'.padStart(15) +
    'Latency p99'.padStart(15) +
    'Errors'.padStart(15)
  )
  console.log('─'.repeat(100))

  results.forEach(result => {
    const reqSec = result.requests.average.toFixed(2)
    const vsBaseline = baseline
      ? `${((result.requests.average / baselineReqSec) * 100).toFixed(1)}%`
      : '-'
    const p50 = `${result.latency.p50.toFixed(2)}ms`
    const p99 = `${result.latency.p99.toFixed(2)}ms`
    const errors = result.errors.toString()

    console.log(
      result.name.padEnd(25) +
      reqSec.padStart(15) +
      vsBaseline.padStart(15) +
      p50.padStart(15) +
      p99.padStart(15) +
      errors.padStart(15)
    )
  })

  console.log('─'.repeat(100))

  // Detailed comparison
  console.log('\n📈 DETAILED METRICS\n')

  results.forEach(result => {
    console.log(`\n${result.name}:`)
    console.log(`  Requests:`)
    console.log(`    Total:      ${result.requests.total}`)
    console.log(`    Average:    ${result.requests.average.toFixed(2)} req/sec`)
    console.log(`    Mean:       ${result.requests.mean.toFixed(2)} req/sec`)
    console.log(`    Stddev:     ${result.requests.stddev.toFixed(2)}`)
    console.log(`  Latency:`)
    console.log(`    Mean:       ${result.latency.mean.toFixed(2)}ms`)
    console.log(`    p50:        ${result.latency.p50.toFixed(2)}ms`)
    console.log(`    p75:        ${result.latency.p75.toFixed(2)}ms`)
    console.log(`    p90:        ${result.latency.p90.toFixed(2)}ms`)
    console.log(`    p99:        ${result.latency.p99.toFixed(2)}ms`)
    console.log(`    Max:        ${result.latency.max.toFixed(2)}ms`)
    console.log(`  Throughput:`)
    console.log(`    Average:    ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`)
  })

  // Winner analysis
  const sortedByReqSec = [...results]
    .filter(r => !r.name.includes('Baseline'))
    .sort((a, b) => b.requests.average - a.requests.average)

  console.log('\n\n🏆 WINNER ANALYSIS\n')
  console.log('Ranked by requests/sec:')
  sortedByReqSec.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
    const overhead = baseline
      ? `${(((baselineReqSec - result.requests.average) / baselineReqSec) * 100).toFixed(1)}% overhead`
      : ''
    console.log(`  ${medal} ${result.name}: ${result.requests.average.toFixed(2)} req/sec ${overhead}`)
  })

  console.log('\n' + '='.repeat(100) + '\n')
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('🚀 lumen HTTP Server Benchmark Suite')
  console.log('Comparing: lumen, morgan, pino, and baseline\n')

  const results: BenchmarkResult[] = []

  try {
    // Benchmark 1: Baseline (no logging)
    results.push(await benchmarkServer(
      'Baseline (no logging)',
      join(__dirname, 'servers/baseline.ts')
    ))

    // Benchmark 2: lumen (dev format)
    results.push(await benchmarkServer(
      'lumen (dev format)',
      join(__dirname, 'servers/lumen-server.ts'),
      { FORMAT: 'dev' }
    ))

    // Benchmark 3: lumen (json format)
    results.push(await benchmarkServer(
      'lumen (json format)',
      join(__dirname, 'servers/lumen-server.ts'),
      { FORMAT: 'json' }
    ))

    // Benchmark 4: morgan (dev format)
    results.push(await benchmarkServer(
      'morgan (dev format)',
      join(__dirname, 'servers/morgan-server.ts'),
      { FORMAT: 'dev' }
    ))

    // Benchmark 5: pino
    results.push(await benchmarkServer(
      'pino (extreme mode)',
      join(__dirname, 'servers/pino-server.ts')
    ))

    // Print results
    printResults(results)

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
  }
}

main()
