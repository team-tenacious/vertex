const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const http = require('http');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();
const utils = require('../../common/utils');
const protocol = require('../../common/protocol').create();

module.exports = class ws extends EventEmitter {

  static get dependants() {
    return ['edge'];
  }

  constructor(server, logger, config) {
    super();
    this.logger = logger;
    this.config = config;
    this.server = server;
    this.clients = {};
    this.defaults();
    this.validate();
    this.WebSocket = require(this.config.wsImplementation);
  }

  async start() {
    this.logger.info('starting');

    await this.startWsService();
  }

  async stop() {
    this.logger.info('stopping');

    await this.stopWsService();
  }

  writeConnectionConfirmation(sessionId) {

    var confirmationMessage = protocol.createMessage('connection-confirmed', {
      server: {
        name: this.server.name,
        address: this.server.services.cluster.advertiseAddress
      }, client: {sessionId: sessionId}
    });

    this.write(sessionId, confirmationMessage);
  }

  async startWsService() {

    this.wss = new this.WebSocket.Server({server: this.server.services.http.httpServer});

    this.wss.on('connection', (ws, req) => {

      var sessionId = hyperid();
      ws.sessionId = sessionId;
      this.clients[sessionId] = ws;

      ws.on('close', () => {
        delete this.clients[ws.sessionId];
        this.emit('disconnection', ws);
      });

      ws.on('error', (e) => {
        this.emit('ws-error', {sessionId: ws.sessionId, error: e});
      });

      ws.on('message', (data) => {
        this.emit('message', {
          sessionId: ws.sessionId,
          data: utils.deserializeWsMessage(data, this.config.wsImplementation)
        });
      });

      this.emit('connection', {sessionId: ws.sessionId, req: req});

      this.writeConnectionConfirmation(sessionId);
    });

    return this.wss;
  }

  async stopWsService() {

    Object.keys(this.clients).forEach((clientId) => {
      this.clients[clientId].close();
    });
  }

  write(sessionId, message) {

    if (!this.clients[sessionId]) return;

    this.clients[sessionId].send(utils.serializeWsMessage(message));
  }

  defaults() {
    this.config.wsImplementation = 'uws';
  }

  validate() {

  }
};
