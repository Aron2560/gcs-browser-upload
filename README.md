# gcs-browser-upload

Chunked, pausable, recoverable uploading to Google Cloud Storage directly from the browser.

Zero runtime dependencies. Native ESM. Works with any bundler (esbuild, vite, webpack, etc.) or as a `<script type="module">`.

## How does it work?

1. User selects a file
1. File + a [Google Cloud Storage resumable upload URL](https://cloud.google.com/storage/docs/json_api/v1/how-tos/upload#resumable) are given to `gcs-browser-upload`
1. File is read in chunks
1. A SHA-256 checksum of each chunk is stored in `localStorage` once successfully uploaded
1. If the page is closed and re-opened, the upload can be resumed by passing the same file and URL back to `gcs-browser-upload`. The file will be validated against the stored chunk checksums to work out if the file is the same and where to resume from.
1. Once the resume index has been found, `gcs-browser-upload` will continue uploading from where it left off.
1. At any time, the `pause` method can be called to delay uploading the remaining chunks. The current chunk will finish uploading first. `unpause` can then be used to continue uploading the remaining chunks.

## Example

There is a full example available at `example/example-client`.

```js
import Upload from 'gcs-browser-upload'

let input = document.getElementById('fileInput')
let pause = document.getElementById('pause')
let unpause = document.getElementById('unpause')
let cancel = document.getElementById('cancel')
let upload = null

input.addEventListener('change', async () => {
  upload = new Upload({
    id: 'foo',
    url: 'https://storage.googleapis.com/upload/storage/v1/b/your-bucket/o?uploadType=resumable&upload_id=...',
    file: input.files[0],
    onChunkUpload: (info) => {
      console.log('Chunk uploaded', info)
    }
  })

  try {
    const result = await upload.start()
    console.log('Upload complete!', result)
  } catch (e) {
    console.log('Upload failed!', e)
  } finally {
    upload = null
  }
})

pause.addEventListener('click', () => {
  if (upload) {
    upload.pause()
  }
})

unpause.addEventListener('click', () => {
  if (upload) {
    upload.unpause()
  }
})

cancel.addEventListener('click', () => {
  if (upload) {
    upload.cancel()
  }
})
```

## Config

```js
{
  id: null,           // required - a unique ID for the upload
  url: null,          // required - GCS resumable session URI
  file: null,         // required - instance of File
  chunkSize: 2097152, // optional - chunk size in bytes (must be a multiple of 262144 / 256KB)
  contentType: null,  // optional - MIME type (defaults to file.type or application/octet-stream)
  onChunkUpload: (info) => {} // optional - progress callback
}
```

The `onChunkUpload` callback receives:

```js
{
  totalBytes: number,    // total file size
  uploadedBytes: number, // bytes uploaded so far
  chunkIndex: number,    // zero-based chunk index
  chunkLength: number    // bytes in this chunk
}
```

## Methods

### `start(): Promise<UploadResult>`

Start or resume the upload. Returns a promise that resolves with `{ status, data }` from the final chunk response.

### `pause()`

Pause the upload. The current in-flight chunk will finish uploading, then the upload halts. Call `unpause()` to continue.

### `unpause()`

Resume a paused upload.

### `cancel()`

Cancel the upload and clear all stored resume metadata from `localStorage`. Throws `UploadCancelledError` from the `start()` promise.

## Handling errors

Error classes are exported as named exports:

```js
import Upload, {
  DontBotherError,
  FileAlreadyUploadedError,
  UrlNotFoundError,
  UploadFailedError,
  UploadIncompleteError,
  InvalidChunkSizeError,
  UploadCancelledError,
} from 'gcs-browser-upload'
```

| Error | When |
|---|---|
| `InvalidChunkSizeError` | `chunkSize` is not a positive multiple of 262144 |
| `FileAlreadyUploadedError` | GCS reports the file is already fully uploaded |
| `UrlNotFoundError` | GCS returns 404 or 410 (session expired) |
| `UploadFailedError` | Server returned a non-retryable error (has `.status` property) |
| `UploadIncompleteError` | Upload did not complete as expected |
| `UploadCancelledError` | `cancel()` was called |
| `DontBotherError` | Upload not worth retrying |

## Developing

```sh
npm install          # install dependencies
npm test             # run tests
npm run test:watch   # continuously run tests
```

## Changes from v2

- **Zero runtime dependencies** — replaced `axios` with native `fetch`, `spark-md5` with `crypto.subtle` SHA-256, `es6-promise`/`es6-error` with native classes
- **Native ESM** — no Babel transpilation, no `regeneratorRuntime` required
- **Retry with backoff** — transient 5xx errors are retried automatically (exponential backoff with jitter)
- **Nullish coalescing for `chunkSize`** — `chunkSize: 0` now correctly throws `InvalidChunkSizeError` instead of silently using the default
- **Error exports** — error classes are named exports (not `Upload.errors` static)
- **`cancel()` method** — cancel an in-progress upload and clear resume metadata
- **Return value** — `start()` returns `{ status, data }` from the final GCS response
- Removed: `storage` option (always uses `window.localStorage`), `allowSmallChunks`, `debug` logging
