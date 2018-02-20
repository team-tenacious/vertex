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

    //TODO: make parallel promise request here

    for (let topic of Object.keys(subscribers)) {

      results[topic] = 0;

      for (let edge of subscribers[topic].edges) {

        var message = protocol.createMessage('subscription-publish', {
          topic: topic,
          message: publishMessage,
          queryPeer: subscribers[topic].queryPeer//introduced so we can decentralise back-pressure on stale client subscriptions
        });

        await this.edge.cluster.request(edge, message);
        results[topic]++;
      }
    }

    return results;
  }

  async querySubscriptions(possibleTopics) {

    var subscribers = {};

    var promises = [];

    for (let topic of possibleTopics) {

      var [subscriptionPeer] = this.edge.hashring.listMembers(topic);

      var message = protocol.createMessage('edges', {topic: topic});

      promises.push(this.edge.cluster.request(subscriptionPeer, message));

      subscribers[topic] = {queryPeer: subscriptionPeer};
    }

    var responses = await Promise.all(promises);

    responses.forEach(function (response, i) {
      subscribers[possibleTopics[i]].edges = response.payload.response;
    });

    return subscribers;
  }

  async process(message) {

    var possibleTopics = this.getWildcardPermutations(message.data.payload.topic);

    var subscribers = await this.querySubscriptions(possibleTopics);

    return await this.postSubscriptions(subscribers, message);
  }
};