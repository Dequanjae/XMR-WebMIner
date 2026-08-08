'use strict';

const { Buffer } = require('buffer');

const EMPTY_BUFFER = Buffer.alloc(0);

/**
 * Merges all supplied buffers into a single buffer.
 *
 * @param {Buffer[]} buffers Buffers to merge
 * @param {Boolean} isBinary Whether the buffers are binary
 * @return {Buffer}
 * @api public
 */
function concat(buffers, isBinary) {
  if (buffers.length === 0) return EMPTY_BUFFER;
  if (buffers.length === 1) return buffers[0];

  if (isBinary) {
    return Buffer.concat(buffers);
  }

  const parts = new Array(buffers.length);
  let totalLength = 0;

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    parts[i] = buf;
    totalLength += buf.length;
  }

  return Buffer.concat(parts, totalLength);
}

/**
 * Checks whether a buffer looks like valid UTF-8.
 *
 * Does not actually validate UTF-8 — that would be
 * time-consuming and expensive.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if the buffer looks like valid UTF-8
 * @api public
 */
function toBuffer(data, encoding) {
  if (Buffer.isBuffer(data)) return data;

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  return Buffer.from(data, encoding);
}

module.exports = { EMPTY_BUFFER, concat, toBuffer };
