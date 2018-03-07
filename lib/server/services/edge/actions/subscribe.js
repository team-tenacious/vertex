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

    // we use a tree-like structure here, because we cannot delete using wildcards

    var topics = await this.edge.cache.get('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress);

    if (topics == null) return;

    for (let topicIndex in topics)
      await this.edge.cache.remove('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + topics[topicIndex]);

    return await this.edge.cache.remove('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress);
  }

  async writeSubscriptionToCache(message){

    //we first write the topic to a trunk set, then to a branch set

    await this.edge.cache.set('EDGE_SUBSCRIPTION_TOPICS:' + this.edge.cluster.advertiseAddress, message.data.payload.topic);

    return await this.edge.cache.set('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + message.data.payload.topic, message.sessionId);
  }

  async process(message){

    var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);

    if (await this.writeSubscriptionToCache(message) == 1) return await this.edge.cluster.request(subscriptionPeer, protocol.createMessage('subscribe', {topic:message.data.payload.topic}));

    return 1;
  }

  async initialize(){

    return this.clearSubscriptions();
  }
};