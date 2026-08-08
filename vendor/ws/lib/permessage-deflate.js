'use strict';

/**
 * Per-message deflate extension implementation.
 *
 * @private
 */
class PerMessageDeflate {
  constructor(options = {}) {
    this._options = options;
    this._isServer = !!options.isServer;
    this._threshold = options.threshold || 1024;
    this._zlibOptions = options.zlibOptions || {};
    this._zlib = null;
    this._zlibInflate = null;
    this._zlibDeflate = null;
  }

  /**
   * Create the zlib library instances.
   *
   * @param {Number} windowBits zlib window bits
   * @private
   */
  static createZlib(windowBits) {
    const zlib = require('zlib');

    return {
      inflate: zlib.createInflateRaw(windowBits),
      deflate: zlib.createDeflateRaw(windowBits)
    };
  }
}

module.exports = PerMessageDeflate;
