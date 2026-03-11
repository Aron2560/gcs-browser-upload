/**
 * Error types for GCS resumable uploads.
 *
 * Forked from QubitProducts/gcs-browser-upload and modernized:
 * - Replaced es6-error with native class extends Error
 * - Zero external dependencies
 */

export class DontBotherError extends Error {
  constructor(message = "Upload not worth retrying") {
    super(message);
    this.name = "DontBotherError";
  }
}

export class FileAlreadyUploadedError extends Error {
  constructor(message = "File already uploaded") {
    super(message);
    this.name = "FileAlreadyUploadedError";
  }
}

export class UrlNotFoundError extends Error {
  constructor(message = "Upload URL not found (410 Gone)") {
    super(message);
    this.name = "UrlNotFoundError";
  }
}

export class UploadFailedError extends Error {
  constructor(status, message = "Upload failed") {
    super(message);
    this.name = "UploadFailedError";
    this.status = status;
  }
}

export class UploadIncompleteError extends Error {
  constructor(message = "Upload incomplete") {
    super(message);
    this.name = "UploadIncompleteError";
  }
}

export class InvalidChunkSizeError extends Error {
  constructor(chunkSize, message) {
    super(message || `Invalid chunk size: ${chunkSize}. Must be a positive multiple of 262144 (256KB).`);
    this.name = "InvalidChunkSizeError";
  }
}

export class UploadCancelledError extends Error {
  constructor(message = "Upload cancelled") {
    super(message);
    this.name = "UploadCancelledError";
  }
}
