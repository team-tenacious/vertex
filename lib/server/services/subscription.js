const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const CONSTANTS = require('../../common/constants');

module.exports = class Subscription extends EventEmitter {

  static get dependants() {
    return [];
  }

  constructor(server, logger, config) {
    super();
    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
  }

  async start() {

  }

  async stop() {

  }

  defaults() {

  }

  validate() {

  }
};