# Remove Node.js Targets & Non-Required Headers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove GCS-ignored headers (Content-Type, Content-Disposition) from chunk PUT requests, add `opts.headers` passthrough for caller-controlled headers, and fix hanging tests by adding an XHR shim.

**Architecture:** The library only handles chunk uploads (not session creation), so Content-Type and Content-Disposition are meaningless on chunk PUTs — GCS ignores them. Replace hardcoded headers with a caller-controlled `opts.headers` passthrough. Fix the test environment by adding a fetch-backed XMLHttpRequest shim to `test/setup.js` so upload.test.js and functional-tests.js can run in Node.

**Tech Stack:** Plain JS (ESM), Vitest, Express (test server)

---

### Task 1: Add fetch-backed XMLHttpRequest shim to test/setup.js

**Files:**
- Modify: `test/setup.js`

**Step 1: Add XMLHttpRequest shim after the FileReader shim**

The shim wraps `globalThis.fetch` to implement the subset of XHR the library uses:
- `open(method, url)`
- `setRequestHeader(name, value)`
- `send(body)`
- `abort()`
- `onload`, `onerror`
- `upload.onprogress`
- `status`, `responseText`
- `getResponseHeader(name)`

```js
// --- XMLHttpRequest shim (fetch-backed) ---
class XMLHttpRequestShim {
  constructor() {
    this.method = null;
    this._url = null;
    this._headers = {};
    this._aborted = false;
    this.status = 0;
    this.responseText = "";
    this.onload = null;
    this.onerror = null;
    this._responseHeaders = {};
    this.upload = { onprogress: null };
    this._abortController = null;
  }

  open(method, url) {
    this.method = method;
    this._url = url;
  }

  setRequestHeader(name, value) {
    this._headers[name] = value;
  }

  getResponseHeader(name) {
    return this._responseHeaders[name.toLowerCase()] ?? null;
  }

  abort() {
    this._aborted = true;
    if (this._abortController) {
      this._abortController.abort();
    }
  }

  send(body) {
    if (this._aborted) return;

    this._abortController = new AbortController();

    const fetchOpts = {
      method: this.method,
      headers: this._headers,
      signal: this._abortController.signal,
    };
    if (body !== null && body !== undefined) {
      fetchOpts.body = body;
    }

    globalThis
      .fetch(this._url, fetchOpts)
      .then(async (res) => {
        if (this._aborted) return;
        this.status = res.status;
        this.responseText = await res.text();
        // Capture response headers
        res.headers.forEach((v, k) => {
          this._responseHeaders[k] = v;
        });
        if (this.onload) this.onload();
      })
      .catch((_err) => {
        if (this._aborted) return;
        if (this.onerror) this.onerror();
      });
  }
}

if (typeof globalThis.XMLHttpRequest === "undefined") {
  globalThis.XMLHttpRequest = XMLHttpRequestShim;
}
```

**Step 2: Run unit tests (errors, file-meta, file-processor) to verify shim doesn't break existing tests**

Run: `npx vitest run test/errors.test.js test/file-meta.test.js test/file-processor.test.js`
Expected: All pass

**Step 3: Run upload.test.js to verify XHR shim fixes the hanging tests**

Run: `npx vitest run test/upload.test.js`
Expected: Tests run to completion (some may fail due to shim differences, but they should not hang)

**Step 4: Run functional-tests.js**

Run: `npx vitest run test/functional-tests.js`
Expected: Tests run to completion

---

### Task 2: Remove hardcoded headers, add opts.headers passthrough in src/upload.js

**Files:**
- Modify: `src/upload.js`

**Step 1: Update constructor**

Remove `contentType` option. Add `headers` option (default `{}`).

Replace:
```js
this.contentType =
  opts.contentType || opts.file.type || "application/octet-stream";
```

With:
```js
this.headers = opts.headers || {};
```

**Step 2: Update `_uploadChunk()`**

Remove these two lines:
```js
xhr.setRequestHeader("Content-Disposition", "attachment");
xhr.setRequestHeader("Content-Type", this.contentType);
```

Replace with a loop over `this.headers`:
```js
for (const [name, value] of Object.entries(this.headers)) {
  xhr.setRequestHeader(name, value);
}
```

Keep `Content-Range` — it's required by GCS.

**Step 3: Update `_uploadSingleChunk()`**

Same change — remove Content-Disposition and Content-Type, add headers loop. Keep NO Content-Range (single-chunk doesn't use it).

**Step 4: Run tests**

Run: `npx vitest run`
Expected: Tests pass (some tests checking for content-disposition/content-type headers will need updating — that's Task 4)

---

### Task 3: Update types.d.ts

**Files:**
- Modify: `types.d.ts`

**Step 1: Update UploadOptions**

Remove: `contentType?: string;`
Add: `headers?: Record<string, string>;`

**Step 2: Update Upload class**

Remove: `contentType: string;`
Add: `headers: Record<string, string>;`

---

### Task 4: Update tests for new header behavior

**Files:**
- Modify: `test/upload.test.js`
- Modify: `test/functional-tests.js`

**Step 1: Remove contentType constructor tests from upload.test.js**

Remove the tests:
- "uses file.type for contentType when available"
- "falls back to application/octet-stream when no contentType"

**Step 2: Add opts.headers passthrough test to upload.test.js**

Add a test that verifies custom headers are sent on chunk PUTs.

**Step 3: Update functional-tests.js header assertions**

In "a single-chunk upload":
- Remove assertion for `content-disposition`
- Remove assertion for `content-type`

In "a multi-chunk upload":
- No header assertions to change (only checks content-range)

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

---

### Task 5: Final verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no hangs

**Step 2: Verify no Node.js-specific code in src/**

Run: `grep -rn "node:" src/ && echo "FOUND NODE IMPORTS" || echo "CLEAN"`
Expected: "CLEAN"
