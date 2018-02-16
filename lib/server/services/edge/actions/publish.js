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

  getWildcardPermutations(topic) {

    var parts = topic.split('/');
    var possible = [topic];

    for (var i = 0; i < parts.length; i++) {
      var possibilityParts = parts.slice(0, i);
      for (var ii = parts.length; ii > i; ii--) possibilityParts.push('*');
      possible.push(possibilityParts.join('/'));
    }

    return possible;
  }

  async postSubscriptions(subscribers, publishMessage) {

    var results = {};

    for (let topic of Object.keys(subscribers)) {

      results[topic] = 0;
      var edges = subscribers[topic];

      for (let edge of edges) {

        var message = protocol.createMessage('subscription-publish', {topic: topic, message: publishMessage});
        await this.edge.cluster.request(edge, message);
        results[topic]++;
      }
    }

    return results;
  }

  async querySubscriptions(possibleTopics) {

    var subscribers = {};

    for (let topic of possibleTopics) {
      var [subscriptionPeer] = this.edge.hashring.listMembers(topic);
      var message = protocol.createMessage('subscription-query', {topic: topic});
      var reply = await this.edge.cluster.request(subscriptionPeer, message);
      subscribers[topic] = reply.edges;
    }

    return subscribers;
  }

  async process(message) {

    var possibleTopics = this.getWildcardPermutations(message.data.payload.topic);

    var subscribers = await this.querySubscriptions(possibleTopics);

    return await this.postSubscriptions(subscribers, message);
  }
};