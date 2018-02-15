const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const CONSTANTS = require('../../common/constants');

module.exports = class Edge extends EventEmitter {

  static get dependants() {
    return [];
  }

  constructor(server, logger, config) {
    super();
    this.server = server;
    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
    this.sockets = {};
    this.connectToWs();
    this.hashring = server.services.hashring;
    this.cluster = server.services.cluster;
    this.cache = server.services.cache;

    this.actionHandlers = {
      error:require('./edge/actions/error').create(this),
      publish:require('./edge/actions/publish').create(this),
      subscribe:require('./edge/actions/subscribe').create(this),
      unsubscribe:require('./edge/actions/unsubscribe').create(this)
    };
  }

  getHandler(action){

    return this.actionHandlers[action];
  }

  onMessage(message){

    if (!this.actionHandlers[message.data.action]) return this.actionHandlers.error.process(message, 'No handler for action: ' + message.data.action);

    var handler = this.getHandler(message.data.action);

    handler.process(message).catch(e => {

      this.emit('message-process-error', e);
    });
  }

  connectToWs(){

    this.server.services.ws.on('message', this.onMessage.bind(this));
  }

  defaults() {

  }

  validate() {

  }
};
