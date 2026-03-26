# AGENTS.md — gcs-browser-upload

Chunked, pausable, resumable uploads to Google Cloud Storage from the browser.
Zero runtime dependencies. Native ESM. Node 20+.

## Quick Reference

```sh
npm install              # install deps (express, vitest — dev only)
npm test                 # run full test suite (vitest run)
npm run test:watch       # watch mode (vitest)
npx vitest run test/errors.test.js              # single test file
npx vitest run -t "throws InvalidChunkSizeError" # single test by name
```

No build step. No linter. No formatter config. Source ships as-is (plain JS + ESM).

## Project Structure

```
src/
  upload.js          # Main Upload class — default export. Chunked upload with retry, pause, cancel.
  errors.js          # 8 custom Error subclasses — all named exports.
  file-meta.js       # localStorage-backed resume state (checksums per chunk).
  file-processor.js  # FileReader chunk reading + SHA-256 checksums via crypto.subtle.
test/
  setup.js           # Browser API shims (localStorage, FileReader, crypto.subtle) for Node.
  upload.test.js     # Unit tests for Upload class (constructor, resume, retry, pause, cancel).
  errors.test.js     # Error class unit tests.
  file-meta.test.js  # FileMeta unit tests.
  file-processor.test.js  # FileProcessor unit tests.
  functional-tests.js     # Integration tests against local Express mock server.
  lib/
    server.js        # Express mock GCS server (308 resume, 200 complete, 4xx/5xx errors).
    makeFile.js      # File/Blob shim for Node tests.
    waitFor.js        # Polling utility (mostly unused — vi.waitFor preferred).
types.d.ts           # Hand-maintained TypeScript declarations for the public API.
```

## Language & Module System

- **Plain JavaScript** — no TypeScript, no JSX, no transpilation.
- **Native ESM** — `"type": "module"` in package.json. All imports use `.js` extensions.
- **TypeScript declarations** in `types.d.ts` — hand-maintained, not generated. Update when changing the public API.
- **Node 20+** required (see `.nvmrc`). Uses `crypto.subtle`, top-level `await` in setup.

## Code Style

### Imports

- ESM `import`/`export` only. No `require()`.
- **Always include `.js` extension** in relative imports: `import FileMeta from "./file-meta.js"`.
- Default export for main classes (`Upload`, `FileMeta`, `FileProcessor`).
- Named exports for error classes and utilities.
- Group: relative imports from `./` or `../` — no external runtime deps exist.

### Formatting

- 2-space indentation.
- Double quotes for strings.
- Trailing commas in multi-line argument lists.
- Semicolons always.
- No trailing whitespace.
- No configured formatter — match existing style manually.

### Naming Conventions

- **Classes**: PascalCase (`Upload`, `FileMeta`, `FileProcessor`).
- **Error classes**: PascalCase ending in `Error` (`UploadFailedError`, `UrlNotFoundError`).
- **Files**: kebab-case (`file-meta.js`, `file-processor.js`).
- **Test files**: `<module>.test.js` or `<description>-tests.js`.
- **Constants**: UPPER_SNAKE_CASE (`MIN_CHUNK_SIZE`, `STORAGE_KEY_PREFIX`, `CHUNK`).
- **Private methods/properties**: underscore prefix (`_paused`, `_backoff()`, `_uploadChunk()`).
- **Variables/functions**: camelCase.

### Error Handling

- Custom error classes extend `Error` directly (no base class).
- Each error sets `this.name` to the class name in the constructor.
- Default messages via parameter defaults: `constructor(message = "Upload cancelled")`.
- `UploadFailedError` carries a `.status` property (HTTP status code).
- Catch blocks that intentionally swallow errors use `_e` (underscore-prefixed unused var).
- Network/transient errors (5xx) are retried with exponential backoff + jitter.
- Non-retryable errors (4xx) throw immediately.

### Classes & Methods

- One class per file. File name matches the class concept in kebab-case.
- JSDoc comments on classes and public methods with `@param` and `@returns`.
- Private methods prefixed with `_` — not truly private, just convention.
- Constructor validates inputs and throws immediately on invalid config.
- Async methods return Promises. No callbacks except optional progress hooks.

### Browser API Usage

- `XMLHttpRequest` for uploads (not `fetch`) — enables `upload.onprogress` events.
- `window.localStorage` for resume metadata.
- `FileReader` for reading file chunks.
- `crypto.subtle.digest("SHA-256", ...)` for checksums.
- A polyfill XHR shim (fetch-backed) is defined in `upload.js` for environments without native XHR.

## Testing

### Framework & Config

- **Vitest** (v3.x) — `vitest.config.js`.
- Test patterns: `test/**/*-test.js`, `test/**/*-tests.js`, `test/**/*.test.js`.
- Global setup: `test/setup.js` — installs browser API shims before all tests.
- Test timeout: 30 seconds.

### Writing Tests

- Import from `vitest`: `describe`, `it`, `expect`, `beforeEach`, `vi`, `beforeAll`, `afterAll`.
- Use `makeFile(data)` from `test/lib/makeFile.js` to create File-like objects.
- Use `start`/`stop`/`resetServer`/`getRequests`/`getBaseURL` from `test/lib/server.js` for integration tests.
- Call `window.localStorage.clear()` in `beforeEach` to isolate resume state.
- Stub `upload._backoff = () => Promise.resolve()` to avoid real delays in retry tests.
- Use `vi.waitFor()` for async assertions (e.g., waiting for pause to take effect).
- Use `vi.spyOn(globalThis, "fetch")` to mock network failures.

### Test Organization

- **Unit tests**: test one module in isolation (`errors.test.js`, `file-meta.test.js`, `file-processor.test.js`).
- **Integration tests**: `upload.test.js` and `functional-tests.js` — use the Express mock server.
- Each `describe` block focuses on one behavior (constructor validation, retry, pause/unpause, cancel).
- Use `afterEach(reset)` pattern to clean up server and localStorage between tests.

## Common Patterns

### Adding a New Error Type

1. Add class to `src/errors.js` extending `Error`, set `this.name`.
2. Export from `src/errors.js` (named export).
3. Re-export from `src/upload.js`.
4. Add to `types.d.ts`.
5. Add test in `test/errors.test.js`.

### Modifying Upload Behavior

1. Change logic in `src/upload.js`.
2. Update `types.d.ts` if public API changed.
3. Add/update tests in `test/upload.test.js` (unit) or `test/functional-tests.js` (integration).
4. If new server behavior needed, add route in `test/lib/server.js`.

## Key Constants

- `MIN_CHUNK_SIZE = 262144` (256KB) — GCS minimum chunk alignment.
- `Default chunkSize = 524288` (512KB) — 2x minimum.
- `STORAGE_KEY_PREFIX = "gcs-resumable-upload-"` — localStorage key prefix.
- `maxRetries = 3` — retry attempts for 5xx/network errors (parameter on `_uploadChunk`).
