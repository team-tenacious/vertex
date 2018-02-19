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

    return this.subscriptionService.cache.get(message.payload.topic)
      .then(subscriptions => {

        if (!subscriptions) return [];

        var index = subscriptions.indexOf(originAddress);

        if (index == -1) return [];

        subscriptions.splice(index, 1);

        return this.subscriptionService.cache.set(message.payload.topic, subscriptions);
      });
  }

  async process(originAddress, message){

    return await this.removeSubscriptionFromCache(originAddress, message);
  }
};