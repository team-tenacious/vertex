const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');
const protocol = require('../../../../common/protocol');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();

module.exports = class SubscribeHandler extends EventEmitter {

  static get dependants() {
    return [];
  }

  constructor(edge) {
    super();
    this.uniqueId = new hyperid();
    this.edge = edge;
  }

  async writeSubscriptionToCache(message){

    let subscriptionKey = ['SUBSCRIPTION:', this.uniqueId, ':', message.data.payload.topic].join();

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

  async respond(message, e){


  }
};