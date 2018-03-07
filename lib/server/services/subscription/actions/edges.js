const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class EdgesHandler extends EventEmitter {

  static create(subscriptionService) {
    return new EdgesHandler(subscriptionService);
  }

  constructor(subscriptionService) {
    super();
    this.subscriptionService = subscriptionService;
  }

  async process(originAddress, message){

    var edges = await this.subscriptionService.cache.get(message.payload.topic);

    return edges;
  }
};