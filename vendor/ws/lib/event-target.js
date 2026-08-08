'use strict';

/**
 * The `EventTarget` interface is implemented by objects that can receive events
 * and may have listeners for them.
 *
 * @see https://dom.spec.whatwg.org/#interface-eventtarget
 */

class EventTarget {
  constructor() {
    this._eventTarget = new EventTarget();
  }

  /**
   * Register a listener.
   *
   * @param {String} type A string representing the event type to listen for
   * @param {Function} listener The listener to be added
   * @param {Object} options An options object specifies characteristics about
   *     the event listener
   * @return {Undefined} this
   * @public
   */
  addEventListener(type, listener, options = {}) {
    let wrapper;

    if (typeof listener !== 'function') return;

    if (options.once) {
      wrapper = (...args) => {
        this.removeEventListener(type, wrapper);
        listener.apply(this, args);
      };
    }

    if (!wrapper) wrapper = listener;

    this._listeners(type).push(wrapper);
    return this;
  }

  /**
   * Remove an event listener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {Function} listener The listener to be removed
   * @return {Undefined} this
   * @public
   */
  removeEventListener(type, listener) {
    const listeners = this._listeners(type);
    const index = listeners.indexOf(listener);

    if (index !== -1) listeners.splice(index, 1);

    return this;
  }

  /**
   * Dispatch an event.
   *
   * @param {Object} event An event to dispatch
   * @return {Boolean} `true` if `event.cancelable` was `false` or
   *     `event.preventDefault()` was not called
   * @public
   */
  dispatchEvent(event) {
    if (!event || !event.type) {
      throw new TypeError('"event.type" is required.');
    }

    event.target = this;

    const listeners = this._listeners(event.type).slice();

    for (let i = 0; i < listeners.length; i++) {
      listeners[i].call(this, event);
    }

    return event.cancelable ? !event.defaultPrevented : true;
  }

  /**
   * @private
   */
  _listeners(type) {
    const listeners = this._listenersMap || (this._listenersMap = {});
    return listeners[type] || (listeners[type] = []);
  }
}

module.exports = EventTarget;
