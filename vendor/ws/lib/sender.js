'use strict';

const { Buffer } = require('buffer');
const { NO_MESSAGE, kWebSocket } = require('./constants');

class Sender {
  constructor(socket, options = {}) {
    this._socket = socket;
    this._firstWrite = true;
    this._bufferedBytes = 0;
    this._buffers = [];
  }

  /**
   * Queue data for transmission.
   *
   * @param {Buffer} data The data to send
   * @param {Object} options Options object
   * @param {Function} cb Called once the data is flushed
   * @private
   */
  queue(data, options, cb) {
    if (this._bufferedBytes === 0) {
      this._socket.write(data, options, cb);
    } else {
      this._buffers.push(data);
      this._bufferedBytes += data.length;
    }
  }

  /**
   * Send a close frame.
   *
   * @param {Number} code Status code
   * @param {String} data The close reason
   * @param {Boolean} mask Whether to mask the data
   * @param {Function} cb Called once the frame is flushed
   * @private
   */
  close(code, data, mask, cb) {
    if (typeof code !== 'number') code = 1000;

    let buf;

    if (code === 1005 || code === 1006) {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      buf = Buffer.allocUnsafe(2 + (data ? Buffer.byteLength(data) : 0));
      buf.writeUInt16BE(code, 0);
      if (data) buf.write(data, 2);
    }

    const frame = createFrame(0x08, buf, mask, this._firstWrite);
    this._firstWrite = false;
    this.queue(frame, null, cb);
  }

  /**
   * Send a ping.
   *
   * @param {Buffer} data The data to send
   * @param {Boolean} mask Whether to mask the data
   * @param {Function} cb Called once the frame is flushed
   * @private
   */
  ping(data, mask, cb) {
    const frame = createFrame(0x09, data, mask, this._firstWrite);
    this._firstWrite = false;
    this.queue(frame, null, cb);
  }

  /**
   * Send a pong.
   *
   * @param {Buffer} data The data to send
   * @param {Boolean} mask Whether to mask the data
   * @param {Function} cb Called once the frame is flushed
   * @private
   */
  pong(data, mask, cb) {
    const frame = createFrame(0x0a, data, mask, this._firstWrite);
    this._firstWrite = false;
    this.queue(frame, null, cb);
  }

  /**
   * Send a message.
   *
   * @param {Buffer} data The data to send
   * @param {Object} options Options object
   * @param {Function} cb Called once the frame is flushed
   * @private
   */
  send(data, options, cb) {
    const isBinary = !options.compress || this._compress !== true;
    const opcode = isBinary ? 0x02 : 0x01;
    const frame = createFrame(opcode, data, this._mask, this._firstWrite);
    this._firstWrite = false;
    this.queue(frame, null, cb);
  }
}

function createFrame(opcode, data, mask, first) {
  const fin = 1;
  const len = data.length;
  let header;

  if (len > 0xffff) {
    header = Buffer.allocUnsafe(10);
    header[0] = (fin ? 0x80 : 0) | opcode;
    header[1] = mask ? 0x80 : 0;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  } else if (len > 0x7d) {
    header = Buffer.allocUnsafe(4);
    header[0] = (fin ? 0x80 : 0) | opcode;
    header[1] = mask ? 0x80 : 0;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(2);
    header[0] = (fin ? 0x80 : 0) | opcode;
    header[1] = mask ? 0x80 : len;
  }

  if (mask) {
    const maskKey = require('crypto').randomBytes(4);
    const unmasked = Buffer.alloc(len);

    for (let i = 0; i < len; i++) {
      unmasked[i] = data[i] ^ maskKey[i & 3];
    }

    return Buffer.concat([header, maskKey, unmasked]);
  }

  return Buffer.concat([header, data]);
}

module.exports = Sender;
