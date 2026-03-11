# Example usage

## Setup

Before you start, you need to enable CORS on the buckets you want to upload to:

```sh
gsutil cors set cors-json-file.json gs://your-bucket-name
```

`cors-json-file.json` is in this folder. You may need to tweak it depending on which HTTP methods you are wanting to call on GCS.

Be aware that the `Origin` header for all requests must be the same. This means if the resumable upload is created on the server side, the same origin as the one used by the browser needs to be passed. See the [documentation](https://cloud.google.com/storage/docs/json_api/v1/how-tos/resumable-upload#start-resumable) for details.

## Running

1. Edit `app.js` and replace the placeholder URL with a real GCS resumable session URI from your server.
2. Serve this directory with any HTTP server (needed for ES module `import` to work):

   ```sh
   npx serve .
   ```

3. Open the served URL in your browser. Pick a file to upload.

## Generating a resumable session URI

You need to generate a resumable upload session URI on your server. For example:

**Python** — use [`google.cloud.storage.blob.Blob.create_resumable_upload_session`](https://googleapis.dev/python/storage/latest/blobs.html#google.cloud.storage.blob.Blob.create_resumable_upload_session). Make sure to pass the browser's `origin` parameter.

**Elixir** — use [`GcsSignedUrl`](https://hexdocs.pm/gcs_signed_url/) or the Google Cloud Storage JSON API directly to create a resumable upload.

**Node.js** — use [`@google-cloud/storage`](https://www.npmjs.com/package/@google-cloud/storage) and call `file.createResumableUpload()`.

## Notes

When generating your upload URL, make sure you specify a PUT method. Otherwise you will get signature mismatch errors.
