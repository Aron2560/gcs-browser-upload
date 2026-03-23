/**
 * File chunk reader with SHA-256 checksums via Web Crypto API.
 *
 * Forked from QubitProducts/gcs-browser-upload and modernized:
 * - Replaced spark-md5 (MD5) with crypto.subtle.digest (SHA-256)
 * - Replaced es6-promise with native Promise
 * - Zero external dependencies
 *
 * SHA-256 replaces MD5 -- fine since checksums are only self-compared
 * for resume validation, not for cryptographic verification.
 */

export default class FileProcessor {
  /**
   * Read a chunk of the file as an ArrayBuffer.
   *
   * @param {File} file - The file to read from
   * @param {number} start - Start byte offset
   * @param {number} chunkSize - Number of bytes to read
   * @returns {Promise<ArrayBuffer>} The chunk data
   */
  readChunk(file, start, chunkSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const blob = file.slice(start, start + chunkSize);

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Compute a SHA-256 checksum of an ArrayBuffer, returned as a hex string.
   *
   * @param {ArrayBuffer} buffer - The data to hash
   * @returns {Promise<string>} Hex-encoded SHA-256 hash
   */
  async checksum(buffer) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
