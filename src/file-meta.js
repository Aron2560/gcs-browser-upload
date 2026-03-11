/**
 * localStorage-backed upload state for resume capability.
 *
 * Forked from QubitProducts/gcs-browser-upload and modernized:
 * - Removed es6-promise polyfill (native Promise)
 * - Zero external dependencies
 *
 * Stores per-file metadata keyed by upload ID. Each entry contains
 * a map of chunk indexes to SHA-256 checksums, used to determine
 * which chunks need re-uploading on resume.
 */

const STORAGE_KEY_PREFIX = "gcs-resumable-upload-";

export default class FileMeta {
  constructor(id, fileSize, chunkSize) {
    this.id = id;
    this.fileSize = fileSize;
    this.chunkSize = chunkSize;
    this.storageKey = STORAGE_KEY_PREFIX + id;
  }

  getMeta() {
    const stored = window.localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_e) {
        // Corrupted data, start fresh
      }
    }
    return {
      checksums: {},
      chunkSize: this.chunkSize,
      fileSize: this.fileSize,
    };
  }

  setMeta(meta) {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(meta));
    } catch (_e) {
      // localStorage full or unavailable -- upload still works, just can't resume
    }
  }

  addChecksum(index, checksum) {
    const meta = this.getMeta();
    meta.checksums[index] = checksum;
    this.setMeta(meta);
  }

  getChecksum(index) {
    return this.getMeta().checksums[index] || null;
  }

  getResumeIndex() {
    return Object.keys(this.getMeta().checksums).length;
  }

  isResumable() {
    const meta = this.getMeta();
    return (
      meta.fileSize === this.fileSize &&
      meta.chunkSize === this.chunkSize &&
      Object.keys(meta.checksums).length > 0
    );
  }

  deleteMeta() {
    window.localStorage.removeItem(this.storageKey);
  }
}
