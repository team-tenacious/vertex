const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class UnSubscribeHandler extends EventEmitter {

  static create(subscriptionService) {
    return new UnSubscribeHandler(subscriptionService);
  }

  constructor(subscriptionService) {
    super();
    this.subscriptionService = subscriptionService;
  }

  async removeSubscriptionFromCache(originAddress, message){

    return await this.subscriptionService.cache.remove(message.payload.topic, originAddress);
  }

  async process(originAddress, message){

    return await this.removeSubscriptionFromCache(originAddress, message);
  }
};