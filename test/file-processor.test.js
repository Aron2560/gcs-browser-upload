import { describe, it, expect } from "vitest";
import FileProcessor from "../src/file-processor.js";
import makeFile from "./lib/makeFile.js";

describe("FileProcessor", () => {
  const processor = new FileProcessor();

  describe("readChunk", () => {
    it("reads a chunk from a file as an ArrayBuffer", async () => {
      const file = makeFile("hello world");
      const buffer = await processor.readChunk(file, 0, 5);

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(5);
    });

    it("reads from an offset", async () => {
      const file = makeFile("hello world");
      const buffer = await processor.readChunk(file, 6, 5);

      const text = new TextDecoder().decode(buffer);
      expect(text).toBe("world");
    });
  });

  describe("checksum", () => {
    it("returns a hex-encoded SHA-256 hash", async () => {
      const file = makeFile("test data");
      const buffer = await processor.readChunk(file, 0, 9);
      const hash = await processor.checksum(buffer);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns the same hash for identical data", async () => {
      const file = makeFile("deterministic");
      const buf1 = await processor.readChunk(file, 0, 13);
      const buf2 = await processor.readChunk(file, 0, 13);

      const hash1 = await processor.checksum(buf1);
      const hash2 = await processor.checksum(buf2);
      expect(hash1).toBe(hash2);
    });

    it("returns different hashes for different data", async () => {
      const file1 = makeFile("data one");
      const file2 = makeFile("data two");
      const buf1 = await processor.readChunk(file1, 0, 8);
      const buf2 = await processor.readChunk(file2, 0, 8);

      const hash1 = await processor.checksum(buf1);
      const hash2 = await processor.checksum(buf2);
      expect(hash1).not.toBe(hash2);
    });
  });
});
