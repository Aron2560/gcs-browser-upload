// Browser globals needed by source: window.localStorage, FileReader, crypto.subtle

// --- localStorage shim ---
const storage = new Map();
const localStorageShim = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
  get length() {
    return storage.size;
  },
  key(index) {
    return [...storage.keys()][index] ?? null;
  },
};

// --- FileReader shim using Node.js Buffer ---
class FileReaderShim {
  constructor() {
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
  }

  readAsArrayBuffer(blob) {
    // blob is a slice from our makeFile helper — it has a .buffer (Node Buffer)
    // or is a Blob-like with an arrayBuffer() method
    try {
      let arrayBuffer;
      if (blob.buffer instanceof ArrayBuffer) {
        // Node Buffer — .buffer gives the underlying ArrayBuffer, but may be shared
        // so we need to slice to the correct region
        arrayBuffer = blob.buffer.slice(
          blob.byteOffset,
          blob.byteOffset + blob.byteLength,
        );
      } else if (blob._data !== undefined) {
        // Our makeFile shim stores raw string data
        const buf = Buffer.from(blob._data, "utf-8");
        arrayBuffer = buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength,
        );
      } else {
        throw new Error("FileReaderShim: unsupported blob type");
      }

      this.result = arrayBuffer;
      if (this.onload) {
        // Call async to match real FileReader behavior
        queueMicrotask(() => this.onload({ target: this }));
      }
    } catch (e) {
      this.error = e;
      if (this.onerror) {
        queueMicrotask(() => this.onerror({ target: this }));
      }
    }
  }
}

// --- Install globals ---
if (typeof globalThis.window === "undefined") {
  globalThis.window = {};
}
globalThis.window.localStorage = localStorageShim;

// Also make localStorage available directly (some code may reference it)
if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = localStorageShim;
}

// FileReader needs to be global (source code does `new FileReader()`)
globalThis.FileReader = FileReaderShim;

// crypto.subtle is available in Node 20+ via globalThis.crypto
// If for some reason it's missing, we'd need webcrypto — but Node 20+ should have it.
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  globalThis.crypto = webcrypto;
}
