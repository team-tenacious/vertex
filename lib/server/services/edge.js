const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const CONSTANTS = require('../../common/constants');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();

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

    this.connectToWs();
    this.connectToCluster();

    this.ws = server.services.ws;
    this.hashring = server.services.hashring;
    this.cluster = server.services.cluster;
    this.cache = server.services['subscription-cache'];
    this.uniqueId = hyperid();
    this.protocol = require('../../common/protocol').create();

    this.actionHandlers = {
      publish: require('./edge/actions/publish').create(this),
      subscribe: require('./edge/actions/subscribe').create(this),
      unsubscribe: require('./edge/actions/unsubscribe').create(this),
      "subscription-publish": require('./edge/actions/subscription-publish').create(this)
    };
  }

  getHandler(action) {

    return this.actionHandlers[action];
  }

  onMessage(message) {
    
    if (!message.data.action || !this.actionHandlers[message.data.action]) return;

    var handler = this.getHandler(message.data.action);

    handler.process(message)
      .then(response => {
        this.respondOK(message, response);
      })
      .catch(e => {
        this.respondError(message, e);
      });
  }

  onClusterMessage(origin, message) {

    if (!message.action || !this.actionHandlers[message.action]) return;

    var handler = this.getHandler(message.action);

    handler.process(origin, message)
      .then(response => {
        this.respondClusterOK(origin, message, response);
      })
      .catch(e => {
        this.respondClusterError(origin, message, e);
      });
  }

  respondClusterOK(origin, message, response){

    this.emit('message-process-ok', {message:message, response:response});
    this.cluster.write(origin, this.protocol.createReply(message, {status:1, response: response}));
  }

  respondClusterError(origin, message, e){

    this.emit('message-process-error', e);
    this.cluster.write(origin, this.protocol.createReply(message, {status:0, error: this.protocol.serializeError(e)}));
  }

  respondOK(message, response){
    this.emit('message-process-ok', {message:message, response:response});
    this.ws.write(message.sessionId, this.protocol.createReply(message.data, {status:1, response: response}));
  }

  respondError(message, e){
    this.emit('message-process-error', e);
    this.ws.write(message.sessionId, this.protocol.createReply(message.data, {status:0, error: this.protocol.serializeError(e)}));
  }

  connectToWs() {

    this.server.services.ws.on('message', this.onMessage.bind(this));
  }

  connectToCluster() {

    this.server.services.cluster.on('message', this.onClusterMessage.bind(this));
  }

  defaults() {

  }

  validate() {

  }

  async start(){

    for (let handlerName in this.actionHandlers){

      var handler = this.actionHandlers[handlerName];
      if (handler.initialize) await handler.initialize();
    }
  }
};
