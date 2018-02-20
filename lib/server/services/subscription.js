const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const CONSTANTS = require('../../common/constants');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();

module.exports = class Subscription extends EventEmitter {

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
    this.connectToCluster();

    this.hashring = server.services.hashring;
    this.cluster = server.services.cluster;
    this.cache = server.services.cache;
    this.protocol = require('../../common/protocol').create();

    this.actionHandlers = {
      subscribe: require('./subscription/actions/subscribe').create(this),
      unsubscribe: require('./subscription/actions/unsubscribe').create(this),
      edges:require('./subscription/actions/edges').create(this)
    };
  }

  getHandler(action) {

    return this.actionHandlers[action];
  }

  onMessage(origin, message) {

    if (!message.action || !this.actionHandlers[message.action]) return;

    var handler = this.getHandler(message.action);

    handler.process(origin, message)
      .then(response => {
        this.respondOK(origin, message, response);
      })
      .catch(e => {
        this.respondError(origin, message, e);
      });
  }

  respondOK(origin, message, response){

    this.emit('message-process-ok', {message:message, response:response});
    this.cluster.write(origin, this.protocol.createReply(message, {status:1, response: response}));
  }

  respondError(origin, message, e){
    
    this.emit('message-process-error', e);
    this.cluster.write(origin, this.protocol.createReply(message, {status:0, error: this.protocol.serializeError(e)}));
  }

  connectToCluster() {

    this.server.services.cluster.on('message', this.onMessage.bind(this));
  }

  defaults() {

  }

  validate() {

  }
};
