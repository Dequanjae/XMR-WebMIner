'use strict';

const { Buffer } = require('buffer');
const { EventEmitter } = require('events');
const { isValidUTF8 } = require('./validation');
const { BINARY_TYPES, EMPTY_BUFFER, NO_MESSAGE, kWebSocket } = require('./constants');

class Receiver extends EventEmitter {
  constructor(options = {}) {
    super();
    this._binaryType = options.binaryType || BINARY_TYPES[0];
    this._extensions = options.extensions || {};
    this._isServer = !!options.isServer;
    this._maxPayload = options.maxPayload || 1024 * 1024;
    this._bufferedBytes = 0;
    this._buffers = [];
    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;
    this._totalPayloadLength = 0;
  }

  /**
   * Implement the `ReadableStream` interface.
   *
   * @return {Undefined} this
   * @public
   */
  write(chunk) {
    this.add(chunk);
    this.startLoop();
    return true;
  }

  /**
   * Add a data chunk to the buffer.
   *
   * @param {Buffer} chunk The chunk to add
   * @private
   */
  add(chunk) {
    this._bufferedBytes += chunk.length;
    this._buffers.push(chunk);
  }

  /**
   * Start the parse loop.
   *
   * @private
   */
  startLoop() {
    let buf;

    while (this._bufferedBytes > 0) {
      buf = this._buffers[0];

      if (buf.length >= 2) {
        this._parse(buf);
      } else {
        break;
      }
    }
  }

  /**
   * Parse the incoming data.
   *
   * @param {Buffer} buf The buffer to parse
   * @private
   */
  _parse(buf) {
    if (buf.length < 2) return;

    const firstByte = buf[0];
    const secondByte = buf[1];
    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (buf.length < 4) return;
      payloadLength = buf.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buf.length < 10) return;
      payloadLength = Number(buf.readBigUInt64BE(2));
      offset = 10;
    }

    if (masked) {
      if (buf.length < offset + 4) return;
      this._mask = buf.slice(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + payloadLength) return;

    let payload = buf.slice(offset, offset + payloadLength);

    if (masked) {
      payload = unmask(payload, this._mask);
    }

    this._bufferedBytes -= offset + payloadLength;
    this._buffers.shift();

    if (this._bufferedBytes === 0) {
      this._buffers = [];
    } else if (this._buffers[0]) {
      this._buffers[0] = this._buffers[0].slice(offset + payloadLength);
    }

    this._handleFrame(opcode, payload, fin);
  }

  /**
   * Handle a decoded frame.
   *
   * @param {Number} opcode The frame opcode
   * @param {Buffer} payload The frame payload
   * @param {Boolean} fin Whether this is the final fragment
   * @private
   */
  _handleFrame(opcode, payload, fin) {
    if (opcode === 0x08) {
      this.emit('conclude', payload.readUInt16BE(0), payload.slice(2));
      return;
    }

    if (opcode === 0x09) {
      this.emit('ping', payload);
      return;
    }

    if (opcode === 0x0a) {
      this.emit('pong', payload);
      return;
    }

    if (opcode === 0x01 || opcode === 0x02) {
      const data = this._binaryType === 'blob'
        ? new Blob([payload])
        : this._binaryType === 'arraybuffer'
          ? payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
          : payload;

      this.emit('message', data, fin);
    }
  }
}

function unmask(buf, mask) {
  const size = buf.length;
  const unmasked = Buffer.allocUnsafe(size);

  for (let i = 0; i < size; i++) {
    unmasked[i] = buf[i] ^ mask[i & 3];
  }

  return unmasked;
}

module.exports = Receiver;
