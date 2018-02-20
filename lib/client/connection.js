const EventEmitter = require('events').EventEmitter;
const utils = require('../common/utils');

module.exports = class Connection extends EventEmitter {

  constructor() {

    super();
  }

  get WebSocketImpl(){
    return require(this.options.wsImplementation);
  }

  send(message) {

    this.websocket.send(utils.serializeWsMessage(message));
  }

  close(code, reason) {

    if (this.websocket) this.websocket.close(code, reason);
  }

  defaults(options){
    if (!options) options = {};
    if (!options.wsImplementation) options.wsImplementation = 'uws';
    return options;
  }

  connect(url, options) {

    this.options = this.defaults(options);

    return new Promise((resolve) => {

      this.websocket = new this.WebSocketImpl(url, options);

      this.websocket.on('close', (code, reason) => {
        this.emit('close', {code: code, reason: reason});
      });

      this.websocket.on('error', (error) => {
        this.emit('error', error);
      });

      this.websocket.on('message', (message) => {

        this.emit('message', utils.deserializeWsMessage(message, this.options.wsImplementation));
      });

      this.websocket.on('ping', (data) => {
        this.emit('ping', data);
      });

      this.websocket.on('pong', (data) => {
        this.emit('pong', data);
      });

      this.websocket.on('open', () => {
        this.emit('open');
        resolve();
      });
    });
  }
};