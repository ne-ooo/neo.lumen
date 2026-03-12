# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-09

### Added

- **`lumen(format, options?)`** — Express/Connect HTTP request logger middleware
- **Predefined formats** — `'combined'`, `'common'`, `'dev'`, `'short'`, `'tiny'`
- **Custom format strings** — `:method :url :status :response-time ms` token syntax
- **Custom format functions** — `(tokens, req, res) => string`
- **Built-in tokens** — `:method`, `:url`, `:status`, `:response-time`, `:date`, `:http-version`, `:remote-addr`, `:remote-user`, `:referrer`, `:user-agent`, `:res[header]`, `:req[header]`
- **Token registration** — `registerToken(name, fn)` for custom tokens
- **Format registration** — `registerFormat(name, format)` for custom named formats
- **Format compilation** — `compileFormat(format)` for pre-compiling format strings
- **Options** — `skip`, `stream`, `immediate`, `includeRequestId`, `redact`
- Zero runtime dependencies
- ESM + CJS dual output with TypeScript declaration files
- Source maps for debugging
- 19 tests across logger and format compilation
