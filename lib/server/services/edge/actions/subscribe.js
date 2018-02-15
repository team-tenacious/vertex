const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');
const protocol = require('../../../../common/protocol').create();

module.exports = class SubscribeHandler extends EventEmitter {

  static create(edge) {
    return new SubscribeHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  async writeSubscriptionToCache(message){

    let subscriptionKey = ['SUBSCRIPTION:', this.edge.uniqueId, ':', message.data.payload.topic].join('');

    return this.edge.cache.get(subscriptionKey)
      .then(subscriptions => {

      if (!subscriptions) subscriptions = [message.sessionId];
      else subscriptions.push(message.sessionId);

      return this.edge.cache.set(subscriptionKey, subscriptions);
    });
  }

  async process(message){

    var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);

    var subscribers = await this.writeSubscriptionToCache(message);

    if (subscribers.length == 1)
      await this.edge.cluster.request(subscriptionPeer, message);
  }

};