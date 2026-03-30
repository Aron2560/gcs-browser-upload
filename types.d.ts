declare module "gcs-browser-upload" {
  type ChunkUploadData = {
    totalBytes: number;
    uploadedBytes: number;
    chunkIndex: number;
    chunkLength: number;
  };

  type UploadOptions = {
    id: string;
    url: string;
    file: File;
    chunkSize?: number;
    headers?: Record<string, string>;
    onChunkUpload?: (data: ChunkUploadData) => void;
    onProgress?: (info: { uploadedBytes: number; totalBytes: number }) => void;
  };

  type UploadResult = {
    status: number;
    data: unknown;
  };

  export default class Upload {
    id: string;
    url: string;
    file: File;
    chunkSize: number;
    headers: Record<string, string>;
    totalChunks: number;
    onChunkUpload: (data: ChunkUploadData) => void;

    constructor(opts: UploadOptions);
    start(): Promise<UploadResult>;
    pause(): void;
    unpause(): void;
    cancel(): void;
  }

  export class DontBotherError extends Error {}
  export class FileAlreadyUploadedError extends Error {}
  export class UrlNotFoundError extends Error {}
  export class UploadFailedError extends Error {
    status: number;
    constructor(status: number, message?: string);
  }
  export class UploadIncompleteError extends Error {}
  export class InvalidChunkSizeError extends Error {
    constructor(chunkSize: number, message?: string);
  }
  export class UploadCancelledError extends Error {}
  export class UploadNetworkError extends Error {}
}
