// Shim File/Blob for Node.js tests — wraps string data with .slice() and .size
export default function makeFile(data) {
  const buf = Buffer.from(data, "utf-8");

  const file = {
    size: buf.byteLength,
    name: "foo",
    type: "text/plain",
    _data: data,

    // .slice(start, end) must return another blob-like that FileReaderShim can handle
    slice(start, end) {
      const slicedBuf = buf.slice(start, end);
      return {
        _data: undefined,
        buffer: slicedBuf.buffer,
        byteOffset: slicedBuf.byteOffset,
        byteLength: slicedBuf.byteLength,
      };
    },
  };

  return file;
}
