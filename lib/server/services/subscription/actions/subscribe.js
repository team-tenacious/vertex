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

    return await this.subscriptionService.cache.get(message.payload.topic)
      .then((subscriptions) => {

        return new Promise(resolve => {

          if (!subscriptions) subscriptions = {};

          var doWrite = true;

          if (!subscriptions[originAddress]) subscriptions[originAddress] = true;
          else doWrite = false;

          resolve({subscriptions: subscriptions, doWrite: doWrite});
        });
      })
      .then((result) => {

        if (result.doWrite) return this.subscriptionService.cache.set(message.payload.topic, result.subscriptions);
        else return result.subscriptions;
      });
  }

  async process(originAddress, message){

    return await this.writeSubscriptionToCache(originAddress, message);
  }
};