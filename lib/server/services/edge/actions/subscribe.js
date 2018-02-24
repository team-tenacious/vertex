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

  async clearSubscriptions(){

    var topics = await this.edge.cache.get('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress);

    if (topics == null) return;

    for (let topicIndex in topics){
      var topicKey = topics[topicIndex];
      await this.edge.cache.remove('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + topicKey);
    }

    return this.edge.cache.remove('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress);
  }

  async writeSubscriptionToCache(message){

    await this.edge.cache.set('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress, message.data.payload.topic);

    return this.edge.cache.set('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + message.data.payload.topic, message.sessionId);
  }

  async process(message){

    var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);

    var subscribers = await this.writeSubscriptionToCache(message);

    if (subscribers.length == 1){
      var subscriptionMessage = protocol.createMessage('subscribe', {topic:message.data.payload.topic});
      return await this.edge.cluster.request(subscriptionPeer, subscriptionMessage);
    }

    return 1;
  }

  async initialize(){

    return this.clearSubscriptions();
  }
};