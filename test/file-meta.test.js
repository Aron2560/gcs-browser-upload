import { describe, it, expect, beforeEach } from "vitest";
import FileMeta from "../src/file-meta.js";

describe("FileMeta", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and retrieves checksums", () => {
    const meta = new FileMeta("test-id", 1000, 256);
    meta.addChecksum(0, "abc123");
    meta.addChecksum(1, "def456");

    expect(meta.getChecksum(0)).toBe("abc123");
    expect(meta.getChecksum(1)).toBe("def456");
    expect(meta.getChecksum(2)).toBeNull();
  });

  it("persists to localStorage keyed by id", () => {
    const meta = new FileMeta("my-upload", 500, 256);
    meta.addChecksum(0, "hash1");

    const raw = window.localStorage.getItem("gcs-resumable-upload-my-upload");
    const parsed = JSON.parse(raw);
    expect(parsed.checksums["0"]).toBe("hash1");
    expect(parsed.fileSize).toBe(500);
    expect(parsed.chunkSize).toBe(256);
  });

  it("isResumable returns false when no data stored", () => {
    const meta = new FileMeta("empty", 1000, 256);
    expect(meta.isResumable()).toBe(false);
  });

  it("isResumable returns true when checksums exist with matching size/chunk", () => {
    const meta = new FileMeta("resumable", 1000, 256);
    meta.addChecksum(0, "hash");
    expect(meta.isResumable()).toBe(true);
  });

  it("isResumable returns false when fileSize changed", () => {
    const meta1 = new FileMeta("changed", 1000, 256);
    meta1.addChecksum(0, "hash");

    const meta2 = new FileMeta("changed", 2000, 256);
    expect(meta2.isResumable()).toBe(false);
  });

  it("isResumable returns false when chunkSize changed", () => {
    const meta1 = new FileMeta("changed-chunk", 1000, 256);
    meta1.addChecksum(0, "hash");

    const meta2 = new FileMeta("changed-chunk", 1000, 512);
    expect(meta2.isResumable()).toBe(false);
  });

  it("deleteMeta clears stored data", () => {
    const meta = new FileMeta("delete-me", 1000, 256);
    meta.addChecksum(0, "hash");
    expect(meta.isResumable()).toBe(true);

    meta.deleteMeta();
    expect(meta.isResumable()).toBe(false);
    expect(window.localStorage.getItem("gcs-resumable-upload-delete-me")).toBeNull();
  });

  it("getResumeIndex returns count of stored checksums", () => {
    const meta = new FileMeta("index-test", 1000, 256);
    expect(meta.getResumeIndex()).toBe(0);

    meta.addChecksum(0, "a");
    meta.addChecksum(1, "b");
    expect(meta.getResumeIndex()).toBe(2);
  });

  it("handles corrupted localStorage gracefully", () => {
    window.localStorage.setItem("gcs-resumable-upload-corrupt", "not-json{{{");
    const meta = new FileMeta("corrupt", 1000, 256);

    expect(meta.isResumable()).toBe(false);
    expect(meta.getChecksum(0)).toBeNull();
  });
});
