'use strict';

/**
 * Expose a rate limiter.
 *
 * @param {Object} options Options object
 * @param {Number} options.max The maximum number of messages per second
 * @param {Number} options.time The time window in milliseconds
 * @private
 */
class Limiter {
  constructor(options = {}) {
    this.max = options.max || Infinity;
    this.duration = options.duration || 1000;
    this.count = 0;
    this.reset = Date.now() + this.duration;
  }

  /**
   * Check if a new message is allowed.
   *
   * @return {Boolean} `true` if allowed, `false` otherwise
   * @public
   */
  check() {
    if (Date.now() > this.reset) {
      this.count = 0;
      this.reset = Date.now() + this.duration;
    }

    return this.count++ < this.max;
  }
}

module.exports = Limiter;
