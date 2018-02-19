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

    return this.subscriptionService.cache.get(message.payload.topic)
      .then(subscriptions => {

        if (!subscriptions) subscriptions = [originAddress];
        else subscriptions.push(originAddress);

        return this.subscriptionService.cache.set(message.payload.topic, subscriptions);
      });
  }

  async process(originAddress, message){

    return await this.writeSubscriptionToCache(originAddress, message);
  }
};