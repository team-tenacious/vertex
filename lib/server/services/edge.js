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
  }

  onMessage(message){

  }

  connectToWs(){

    this.server.services.ws.on('message', this.onMessage.bind(this));
  }

  defaults() {

  }

  validate() {

  }
};
