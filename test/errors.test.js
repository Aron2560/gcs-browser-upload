import { describe, it, expect } from "vitest";
import {
  DontBotherError,
  FileAlreadyUploadedError,
  UrlNotFoundError,
  UploadFailedError,
  UploadIncompleteError,
  InvalidChunkSizeError,
  UploadCancelledError,
} from "../src/errors.js";

describe("errors", () => {
  it("all extend Error", () => {
    expect(new DontBotherError()).toBeInstanceOf(Error);
    expect(new FileAlreadyUploadedError()).toBeInstanceOf(Error);
    expect(new UrlNotFoundError()).toBeInstanceOf(Error);
    expect(new UploadFailedError(500)).toBeInstanceOf(Error);
    expect(new UploadIncompleteError()).toBeInstanceOf(Error);
    expect(new InvalidChunkSizeError(100)).toBeInstanceOf(Error);
    expect(new UploadCancelledError()).toBeInstanceOf(Error);
  });

  it("UploadFailedError stores status", () => {
    const err = new UploadFailedError(502, "Bad gateway");
    expect(err.status).toBe(502);
    expect(err.message).toBe("Bad gateway");
    expect(err.name).toBe("UploadFailedError");
  });

  it("InvalidChunkSizeError includes chunk size in message", () => {
    const err = new InvalidChunkSizeError(100);
    expect(err.message).toContain("100");
    expect(err.name).toBe("InvalidChunkSizeError");
  });

  it("each error has a distinct name property", () => {
    const names = [
      new DontBotherError().name,
      new FileAlreadyUploadedError().name,
      new UrlNotFoundError().name,
      new UploadFailedError(500).name,
      new UploadIncompleteError().name,
      new InvalidChunkSizeError(100).name,
      new UploadCancelledError().name,
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
