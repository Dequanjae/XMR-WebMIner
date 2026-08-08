'use strict';

const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { Receiver } = require('./receiver');
const { Sender } = require('./sender');
const { WebSocket, CONNECTING, OPEN, CLOSING, CLOSED } = require('./stream');

module.exports = WebSocket;
WebSocket.Server = require('./websocket-server');
WebSocket.Receiver = Receiver;
WebSocket.Sender = Sender;
WebSocket.CONNECTING = CONNECTING;
WebSocket.OPEN = OPEN;
WebSocket.CLOSING = CLOSING;
WebSocket.CLOSED = CLOSED;
