'use strict';

// This is here so webpack's uglify can drop the
// process.env.NODE_ENV check.
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  BINARY_TYPES: isProduction
    ? ['nodebuffer', 'arraybuffer']
    : ['nodebuffer', 'arraybuffer', 'blob'],
  GUID: '258EAFA5-E914-47DA-95CA-5AB5DC11E5B7',
  kAfterAsync: Symbol('kAfterAsync'),
  kBeforeAsync: Symbol('kBeforeAsync'),
  kBufferedBytes: Symbol('kBufferedBytes'),
  kBuffers: Symbol('kBuffers'),
  kCallback: Symbol('kCallback'),
  kError: Symbol('kError'),
  kReadyState: Symbol('kReadyState'),
  kTotalBytes: Symbol('kTotalBytes'),
  kType: Symbol('kType'),
  kWebSocket: Symbol('kWebSocket'),
  NO_MESSAGE: 0x80000000
};
