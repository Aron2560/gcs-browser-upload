# Single-Chunk Upload Optimization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a file is smaller than or equal to the configured `chunkSize`, upload it in a single PUT request without `Content-Range`, matching the GCS single-chunk resumable upload protocol.

**Architecture:** Add an early-return branch in `start()` that calls a new `_uploadSingleChunk()` method. This method sends one PUT with `Content-Disposition` and `Content-Type` headers (no `Content-Range`), handles retry on 5xx/network errors, and supports cancel via `_activeXHR.abort()`. The multi-chunk path remains unchanged.

**Tech Stack:** Plain JavaScript (ESM), Vitest, Express mock server

---

### Task 1: Update mock server to accept single-chunk uploads (no Content-Range)

**Files:**
- Modify: `test/lib/server.js:12-36` (the Content-Range validation middleware)

**Step 1: Write the server change**

The current middleware rejects any request without a `Content-Range` header. Modify it so that requests without `Content-Range` are passed through with `req.range = null` instead of being rejected. The route handler at `router.put("/", ...)` needs to handle the `req.range === null` case as a single-chunk upload.

In `test/lib/server.js`, replace the Content-Range middleware (lines 12-36) with:

```js
router.use((req, res, next) => {
  const range = req.headers["content-range"];
  if (!range) {
    // No Content-Range = single-chunk upload
    req.range = null;
    next();
    return;
  }

  const matchKnown = range.match(/^bytes (\d+?)-(\d+?)\/(\d+?)$/);
  const matchUnknown = range.match(/^bytes \*\/(\d+?)$/);

  if (matchUnknown) {
    req.range = { known: false, total: parseInt(matchUnknown[1]) };
    next();
  } else if (matchKnown) {
    req.range = {
      known: true,
      start: parseInt(matchKnown[1]),
      end: parseInt(matchKnown[2]),
      total: parseInt(matchKnown[3]),
    };
    next();
  } else {
    res.status(400).send("No valid content-range header provided");
  }
});
```

Then update `router.put("/", ...)` to handle single-chunk:

```js
router.put("/", (req, res) => {
  // Single-chunk upload (no Content-Range)
  if (req.range === null) {
    res.status(200).json({ status: "ok" });
    return;
  }

  if (!file) {
    file = { total: req.range.total, index: 0 };
  }

  if (req.range.known) {
    file.index = req.range.end;
  }

  res.set("range", `bytes=0-${file.index}`);

  if (file.index + 1 >= file.total) {
    res.status(200).json({ status: "ok" });
  } else {
    res.status(308).send("Resume Incomplete");
  }
});
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `npm test`
Expected: All existing tests PASS (server behavior for multi-chunk is unchanged; single-chunk tests don't exist yet)

**Step 3: Commit**

```
test: update mock server to accept single-chunk uploads without Content-Range
```

---

### Task 2: Add `_uploadSingleChunk()` method to Upload class

**Files:**
- Modify: `src/upload.js` (add new method, add branch in `start()`)

**Step 1: Write the failing test for single-chunk upload**

In `test/upload.test.js`, add a new describe block:

```js
describe("single-chunk upload (file <= chunkSize)", () => {
  it("uploads file in one request without Content-Range header", async () => {
    const fileData = randomData(100); // well under CHUNK size
    const upload = new Upload({
      id: "single-chunk-test",
      url: `${getBaseURL()}/file`,
      file: makeFile(fileData),
      chunkSize: CHUNK,
    });

    const result = await upload.start();

    expect(result).toEqual({ status: 200, data: { status: "ok" } });

    const reqs = getRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].method).toBe("PUT");
    expect(reqs[0].headers["content-range"]).toBeUndefined();
    expect(reqs[0].headers["content-disposition"]).toBe("attachment");
    expect(reqs[0].headers["content-type"]).toBeDefined();
  });

  it("fires onChunkUpload callback once", async () => {
    const chunks = [];
    const fileData = randomData(100);
    const upload = new Upload({
      id: "single-chunk-cb",
      url: `${getBaseURL()}/file`,
      file: makeFile(fileData),
      chunkSize: CHUNK,
      onChunkUpload: (info) => chunks.push(info),
    });

    await upload.start();

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      uploadedBytes: 100,
      totalBytes: 100,
      chunkIndex: 0,
      chunkLength: 100,
    });
  });

  it("clears localStorage meta on completion", async () => {
    const fileData = randomData(100);
    const upload = new Upload({
      id: "single-chunk-meta",
      url: `${getBaseURL()}/file`,
      file: makeFile(fileData),
      chunkSize: CHUNK,
    });

    await upload.start();
    expect(upload.meta.isResumable()).toBe(false);
  });

  it("supports cancel during single-chunk upload", async () => {
    const fileData = randomData(100);
    const upload = new Upload({
      id: "single-chunk-cancel",
      url: `${getBaseURL()}/file`,
      file: makeFile(fileData),
      chunkSize: CHUNK,
    });

    upload.cancel();
    await expect(upload.start()).rejects.toThrow(UploadCancelledError);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/upload.test.js -t "single-chunk upload"`
Expected: FAIL — `_uploadSingleChunk` does not exist yet, or single-chunk requests still send `Content-Range`

**Step 3: Implement `_uploadSingleChunk()` and branch in `start()`**

In `src/upload.js`, add the early return in `start()` (at the very beginning of the method, before `_getResumeOffset`):

```js
async start() {
  // Single-chunk optimization: if file fits in one chunk, skip resume/chunking logic
  if (this.file.size <= this.chunkSize) {
    return this._uploadSingleChunk();
  }

  // ... existing multi-chunk logic unchanged ...
}
```

Add the `_uploadSingleChunk()` method to the Upload class (after `_uploadChunk`, before `pause`):

```js
/**
 * Upload the entire file in a single PUT request (no Content-Range).
 * Used when file.size <= chunkSize for optimal performance.
 * @param {number} [maxRetries=3] - Maximum retry attempts for 5xx/network errors
 * @returns {Promise<Object>} Parsed response
 */
async _uploadSingleChunk(maxRetries = 3) {
  if (this._cancelled) {
    this.meta.deleteMeta();
    throw new UploadCancelledError();
  }

  const buffer = await this.processor.readChunk(this.file, 0, this.file.size);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (this._cancelled) {
      this.meta.deleteMeta();
      throw new UploadCancelledError();
    }

    let response;

    try {
      const xhr = new XMLHttpRequest();
      this._activeXHR = xhr;
      response = await new Promise((resolve, reject) => {
        xhr.open("PUT", this.url);
        xhr.setRequestHeader("Content-Disposition", "attachment");
        xhr.setRequestHeader("Content-Type", this.contentType);
        if (xhr.upload) {
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable && !this._cancelled) {
              this.onProgress({
                uploadedBytes: evt.loaded,
                totalBytes: this.file.size,
              });
            }
          };
        }
        xhr.onload = () => {
          this._activeXHR = null;
          resolve({ status: xhr.status, responseText: xhr.responseText });
        };
        xhr.onerror = () => {
          this._activeXHR = null;
          if (xhr.status === 0) {
            resolve({ status: 200, data: null, _corsSuccess: true });
          } else {
            reject(new UploadNetworkError());
          }
        };
        xhr.send(buffer);
      });

      if (response._corsSuccess === true) {
        this.meta.deleteMeta();
        this.onChunkUpload({
          uploadedBytes: this.file.size,
          totalBytes: this.file.size,
          chunkIndex: 0,
          chunkLength: this.file.size,
        });
        return { status: 200, data: null };
      }
    } catch (error) {
      if (attempt < maxRetries) {
        await this._backoff(attempt);
        continue;
      }
      throw error;
    }

    // Success
    if (response.status === 200 || response.status === 201) {
      const body = JSON.parse(response.responseText);
      this.meta.deleteMeta();
      this.onChunkUpload({
        uploadedBytes: this.file.size,
        totalBytes: this.file.size,
        chunkIndex: 0,
        chunkLength: this.file.size,
      });
      return { status: response.status, data: body };
    }

    // 404/410 — session expired
    if (response.status === 404 || response.status === 410) {
      this.meta.deleteMeta();
      throw new UrlNotFoundError();
    }

    // 5xx — retry with backoff
    if (response.status >= 500) {
      if (attempt < maxRetries) {
        await this._backoff(attempt);
        continue;
      }
      throw new UploadFailedError(
        response.status,
        `Server error: ${response.status}`,
      );
    }

    // Other 4xx — not retryable
    throw new UploadFailedError(
      response.status,
      `Upload failed with status ${response.status}`,
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/upload.test.js -t "single-chunk upload"`
Expected: All 4 new tests PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS (existing multi-chunk tests unaffected)

**Step 6: Commit**

```
feat: add single-chunk upload optimization for files <= chunkSize
```

---

### Task 3: Update functional tests for single-chunk behavior

**Files:**
- Modify: `test/functional-tests.js:40-63` (the existing "a single-chunk upload" describe block)

**Step 1: Update the existing single-chunk functional test**

The current "a single-chunk upload" test (lines 40-63) uploads a file of exactly `CHUNK` size using the multi-chunk path — it sends `Content-Range`. With the new optimization, files <= `chunkSize` use the single-chunk path, so this test's assertions about `Content-Range` must change.

Replace the existing "a single-chunk upload" describe block:

```js
describe("a single-chunk upload", () => {
  let fileData;

  beforeAll(async () => {
    fileData = randomData(CHUNK);
    await doUpload(fileData);
  });
  afterEach(reset);

  it("should only upload one chunk", () => {
    expect(requests).toHaveLength(1);
  });

  it("should make a PUT request to the right URL", () => {
    expect(requests[0].method).toBe("PUT");
    expect(requests[0].url).toBe("/file");
  });

  it("should not send a content-range header", () => {
    expect(requests[0].headers["content-range"]).toBeUndefined();
  });

  it("should send content-disposition and content-type headers", () => {
    expect(requests[0].headers["content-disposition"]).toBe("attachment");
    expect(requests[0].headers["content-type"]).toBeDefined();
  });
});
```

**Step 2: Run the functional tests**

Run: `npx vitest run test/functional-tests.js`
Expected: All tests PASS

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 4: Commit**

```
test: update functional tests for single-chunk upload behavior
```

---

### Task 4: Final verification

**Step 1: Run full test suite one final time**

Run: `npm test`
Expected: All tests PASS

**Step 2: Verify no lint/type issues**

Run: `npx vitest run` (full run, no filter)
Expected: All tests PASS, no warnings

**Step 3: Review changed files**

Verify:
- `src/upload.js` — `_uploadSingleChunk()` method added, `start()` has early return branch
- `test/lib/server.js` — accepts requests without `Content-Range`
- `test/upload.test.js` — new single-chunk describe block
- `test/functional-tests.js` — updated single-chunk assertions
- No changes to `types.d.ts`, `errors.js`, `file-meta.js`, `file-processor.js`
