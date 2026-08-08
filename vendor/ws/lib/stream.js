'use strict';

const { Stream } = require('stream');
const { EventEmitter } = require('events');
const { Receiver } = require('./receiver');
const { Sender } = require('./sender');
const { kWebSocket } = require('./constants');

class WebSocket extends EventEmitter {
  constructor(address, protocols, options = {}) {
    super();

    this.readyState = WebSocket.CONNECTING;
    this._protocol = '';
    this._extensions = {};
    this._bufferedAmount = 0;
    this._isServer = options.isServer;
    this._binaryType = options.binaryType || 'nodebuffer';
    this._permitDrain = true;
    this._closeFrameSent = false;
    this._closeFrameReceived = false;
    this._closeMessage = '';
    this._closeTimer = null;
    this._receiver = null;
    this._sender = null;
    this._socket = null;
    this._url = address;
    this._req = null;
  }

  /**
   * Send a message.
   *
   * @param {*} data The data to send
   * @param {Object} options Options object
   * @param {Function} cb Called once the data is flushed
   * @return {Boolean} `true` if the data was sent
   * @public
   */
  send(data, options, cb) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    return this._sender.send(data, options || {}, cb);
  }

  /**
   * Initiate a close.
   *
   * @param {Number} code Status code
   * @param {String} reason The close reason
   * @return {Undefined} this
   * @public
   */
  close(code, reason) {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      return this._readyStateChange(WebSocket.CLOSED, new Error(msg));
    }

    this._readyStateChange(WebSocket.CLOSING);
    this._sender.close(code || 1000, reason || '', false, (err) => {
      if (err) this._readyStateChange(WebSocket.CLOSED, err);
      else this._readyStateChange(WebSocket.CLOSED);
    });
  }
}

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

module.exports = WebSocket;
