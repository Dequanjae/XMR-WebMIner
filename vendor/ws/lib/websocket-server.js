'use strict';

const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('./websocket');

/**
 * WebSocket server implementation.
 *
 * @param {Object} options Server options
 * @public
 */
class WebSocketServer extends EventEmitter {
  constructor(options = {}, callback) {
    super();

    options = {
      port: null,
      host: null,
      path: '/',
      backlog: null,
      server: null,
      clientTracking: true,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024,
      ...options
    };

    this._server = options.server;
    this._clients = new Set();
    this._options = options;

    if (!this._server) {
      this._server = options.port
        ? http.createServer()
        : http.createServer(options.requestListener || noop);
    }

    this._server.listen(options.port, options.host, options.backlog, () => {
      this.emit('listening');
      if (callback) callback();
    });
  }

  /**
   * Handle upgrade requests.
   *
   * @param {Object} req The upgrade request
   * @param {Object} socket The socket
   * @param {Buffer} head The first packet of the upgraded stream
   * @private
   */
  handleUpgrade(req, socket, head) {
    const ws = new WebSocket(null, undefined, {
      isServer: true,
      ...this._options
    });

    ws._socket = socket;

    if (this._options.clientTracking) {
      this._clients.add(ws);
      ws.on('close', () => this._clients.delete(ws));
    }

    this.emit('connection', ws, req);
  }

  /**
   * Close the server.
   *
   * @param {Function} cb Called once the server is closed
   * @public
   */
  close(cb) {
    this._server.close(cb);
  }
}

function noop() {}

module.exports = { WebSocketServer };
