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

    //remove the sessionId from topic / sessions index
    var membersLeft = await this.edge.cache.remove('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + message.data.payload.topic, message.sessionId);

    //no more members? then remove the trunk, we have no more subscriptions on this key
    if (membersLeft == 0) return await this.edge.cache.remove('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress, message.data.payload.topic);

    else return membersLeft;
  }

  async process(message){

    var membersLeft = await this.removeSubscriptionFromCache(message);

    if (membersLeft == 0) {

      var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);
      return await this.edge.cluster.request(subscriptionPeer, protocol.createMessage('unsubscribe', {topic:message.data.payload.topic}));
    }

    return 1;
  }

};