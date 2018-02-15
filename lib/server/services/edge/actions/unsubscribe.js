const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');
const protocol = require('../../../../common/protocol').create();

module.exports = class UnSubscribeHandler extends EventEmitter {

  static create(edge) {
    return new UnSubscribeHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  async removeSubscriptionFromCache(message){

    let subscriptionKey = ['SUBSCRIPTION:', this.edge.uniqueId, ':', message.data.payload.topic].join('');

    return this.edge.cache.get(subscriptionKey)
      .then(subscriptions => {

        if (!subscriptions) return;

        var index = subscriptions.indexOf(message.sessionId);

        if (index !== -1) {
          subscriptions.splice(index, 1);
        }

        return this.edge.cache.set(subscriptionKey, subscriptions);
      });
  }

  async process(message){

    var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);

    var subscribers = await this.removeSubscriptionFromCache(message);

    if (subscribers != null && subscribers.length == 0)
      await this.edge.cluster.request(subscriptionPeer, message);
  }

};