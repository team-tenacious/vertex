const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class SubscribeHandler extends EventEmitter {

  static create(subscriptionService) {
    return new SubscribeHandler(subscriptionService);
  }

  constructor(subscriptionService) {
    super();
    this.subscriptionService = subscriptionService;
  }

  async writeSubscriptionToCache(originAddress, message){

    return await this.subscriptionService.cache.set(message.payload.topic, originAddress);
  }

  async process(originAddress, message){

    return await this.writeSubscriptionToCache(originAddress, message);
  }
};