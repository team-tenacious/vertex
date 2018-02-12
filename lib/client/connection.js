const WebSocket = require('ws');
const EventEmitter = require('events').EventEmitter;

module.exports = class Connection extends EventEmitter {

  constructor() {

  }

  send(message) {

    this.websocket.send(message);
  }

  close(code, reason) {

    if (this.websocket) this.websocket.close(code, reason);
  }

  connect(url, options) {

    return new Promise((resolve) => {

      this.websocket = new WebSocket(url, options);

      this.websocket = new WebSocket(url, options);

      this.websocket.on('close', (code, reason) => {
        this.emit('close', {code: code, reason: reason});
      });

      this.websocket.on('error', (error) => {
        this.emit('error', error);
      });

      this.websocket.on('message', (message) => {
        this.emit('message', message);
      });

      this.websocket.on('ping', (data) => {
        this.emit('ping', data);
      });

      this.websocket.on('pong', (data) => {
        this.emit('pong', data);
      });

      this.websocket.on('open', function () {
        this.emit('open');
        resolve();
      });
    });
  }
};