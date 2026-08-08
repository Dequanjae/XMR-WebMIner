'use strict';

module.exports = function WebSocket(url, protocols) {
  return protocols ? new WebSocket(url, protocols) : new WebSocket(url);
};
