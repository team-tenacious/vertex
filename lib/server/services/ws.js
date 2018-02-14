const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const http = require('http');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();
const WebSocket = require('ws');

module.exports = class ws extends EventEmitter {

  static get dependants() { return []; }

  constructor(server, logger, config) {
    super();
    this.logger = logger;
    this.config = config;
    this.server = server;
    this.clients = {};
    this.defaults();
    this.validate();
  }

  async start() {
    this.logger.info('starting');

    await this.startWsService();
  }

  async stop() {
    this.logger.info('stopping');

    await this.stopWsService();
  }

  async startWsService() {

    this.wss = new WebSocket.Server({server:this.server.services.http.httpServer});

    this.wss.on('connection', (ws, req) => {

      var sessionId = hyperid();
      ws.sessionId = sessionId;
      this.clients[sessionId] = ws;

      ws.on('close', () => {
        delete this.clients[ws.sessionId];
      });

      ws.on('error', (e) => {
        this.emit('ws-error', {ws: ws, error: e});
      });

      ws.on('message', (data) => {
        this.emit('message', {ws: ws, data: data});
      });

      this.emit('connection', {ws: ws, req: req});
    });

    return this.wss;
  }

  async stopWsService() {

    Object.keys(this.clients).forEach((clientId) => {
      this.clients[clientId].close();
    });
  }

  defaults() {

  }

  validate() {

  }
};
