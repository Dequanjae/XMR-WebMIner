'use strict';

const { randomBytes } = require('crypto');
const { GUID } = require('./constants');

/**
 * Generate a GUID.
 *
 * @return {String} A new GUID
 * @private
 */
function generateGUID() {
  return randomBytes(16).toString('hex');
}

module.exports = { generateGUID, GUID };
