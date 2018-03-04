const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');
const protocol = require('../../../../common/protocol').create();

module.exports = class PublishHandler extends EventEmitter {

  static create(edge) {
    return new PublishHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  //back pressure - removes edge from the cluster subscription to topic if no clients subscribed on topic
  async removeClusterSubscriptions(topic){

    var unsubscribeMessage = protocol.createMessage('cluster-unsubscribe', {topic: topic});

    var [subscriptionPeer] = this.edge.hashring.listMembers(topic);

    return await this.edge.cluster.request(subscriptionPeer, unsubscribeMessage);
  }

  async emitSubscriptions(subscribers, topic, payload) {

    var emittedCount = 0;

    var promises = [];

    for (let client of subscribers) {

      var message = protocol.createMessage('publish', {topic: topic, data:payload});

      promises.push(this.edge.ws.write(client, message));
    }

    var responses = await Promise.all(promises);

    responses.forEach(function () {
      emittedCount++;
    });

    return emittedCount;
  }

  async querySubscriptions(topic) {

    return await this.edge.cache.get('EDGE_SUBSCRIPTION_SESSIONS:' + this.edge.cluster.advertiseAddress + ':' + topic);
  }

  async process(origin, message) {

    var subscribers = await this.querySubscriptions(message.payload.topic);

    if (subscribers.length == 0) return await this.removeClusterSubscriptions(message.payload.topic);

    return await this.emitSubscriptions(subscribers, message.payload.topic, message.payload.message.data.payload);
  }
};