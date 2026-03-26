import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import crypto from "node:crypto";
import Upload, {
  UrlNotFoundError,
  UploadFailedError,
} from "../src/upload.js";
import { start, resetServer, stop, getRequests, getBaseURL } from "./lib/server.js";
import makeFile from "./lib/makeFile.js";

const CHUNK = 262144; // minimum valid chunk size (256KB)

function randomData(length) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

describe("Functional", () => {
  beforeAll(start);
  afterAll(stop);

  let requests = [];

  async function doUpload(fileData, urlPath) {
    const url = `${getBaseURL()}${urlPath || "/file"}`;
    const upload = new Upload({
      id: "foo",
      url,
      chunkSize: CHUNK,
      file: makeFile(fileData),
    });
    await upload.start();
    requests = getRequests();
    return upload;
  }

  function reset() {
    window.localStorage.clear();
    resetServer();
  }

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

  describe("a multi-chunk upload", () => {
    const totalSize = CHUNK * 2 + 100;
    let fileData;

    beforeAll(async () => {
      fileData = randomData(totalSize);
      await doUpload(fileData);
    });
    afterEach(reset);

    it("should upload multiple chunks", () => {
      expect(requests).toHaveLength(3);
    });

    it("should make multiple PUT requests to the right URL", () => {
      requests.forEach((r) => {
        expect(r.method).toBe("PUT");
        expect(r.url).toBe("/file");
      });
    });

    it("should send the correct content-range headers", () => {
      const end1 = CHUNK - 1;
      const end2 = CHUNK * 2 - 1;
      const end3 = totalSize - 1;

      expect(requests[0].headers["content-range"]).toBe(
        `bytes 0-${end1}/${totalSize}`,
      );
      expect(requests[1].headers["content-range"]).toBe(
        `bytes ${CHUNK}-${end2}/${totalSize}`,
      );
      expect(requests[2].headers["content-range"]).toBe(
        `bytes ${CHUNK * 2}-${end3}/${totalSize}`,
      );
    });

    it("should send a total content length matching the file size", () => {
      const totalSent = requests.reduce(
        (sum, r) => sum + parseInt(r.headers["content-length"]),
        0,
      );
      expect(totalSent).toBe(totalSize);
    });
  });

  describe("an upload to a url that doesn't exist", () => {
    afterEach(reset);

    it("should throw a UrlNotFoundError", async () => {
      const fileData = randomData(200);
      await expect(doUpload(fileData, "/notfound")).rejects.toThrow(
        UrlNotFoundError,
      );
    });
  });

  describe("an upload that results in a server error", () => {
    afterEach(reset);

    it("should throw an UploadFailedError", async () => {
      const fileData = randomData(200);
      await expect(doUpload(fileData, "/file/fail")).rejects.toThrow(
        UploadFailedError,
      );
    });
  });
});
