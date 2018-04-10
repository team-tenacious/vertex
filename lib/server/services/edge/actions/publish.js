const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');
const protocol = require('../../../../common/protocol').create();
const LRU = require("lru-cache");

module.exports = class PublishHandler extends EventEmitter {

  static create(edge) {
    return new PublishHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
    this.wildcardCache = new LRU({max: 5000});
  }

  getWildcardPermutations(topic) {

    if (this.wildcardCache.has(topic))
      return this.wildcardCache.get(topic);

    var clonedTopic = topic.toString();

    var leadingSlash = false;
    var trailingSlash = false;

    if (topic[0] == '/') {
      clonedTopic = clonedTopic.slice(1);
      leadingSlash = true;
    }

    if (clonedTopic[clonedTopic.length - 1] == '/') {
      clonedTopic = clonedTopic.substring(0, clonedTopic.length - 1);
      trailingSlash = true;
    }

    var parts = clonedTopic.split('/');
    var possible = [topic];

    for (var i = 0; i < parts.length; i++) {

      var possibilityParts = parts.slice(0, i);

      for (var ii = parts.length; ii > i; ii--) possibilityParts.push('*');

      var possibility = possibilityParts.join('/');

      if (leadingSlash) possibility = '/' + possibility;
      if (trailingSlash) possibility = possibility + '/';

      possible.push(possibility);
    }

    this.wildcardCache.set(topic, possible);

    return possible;
  }

  async postSubscriptions(subscribers, publishMessage) {

    var results = {};

    //TODO: make parallel promise request here (breaks tcp layer for some odd reason)

    for (let topic of Object.keys(subscribers)) {

      results[topic] = 0;

      for (let edge of subscribers[topic].edges) {

        var message = protocol.createMessage('subscription-publish', {
          topic: topic,
          message: publishMessage.data.payload,
          queryPeer: subscribers[topic].queryPeer//introduced so we can decentralise back-pressure on stale client subscriptions
        });

        var response = await this.edge.cluster.request(edge, message);
        results[response.payload.response.topic] += response.payload.response.emitted;
      }
    }

    return results;
  }

  // async postSubscriptions(subscribers, publishMessage) {
  //
  //   var results = {};
  //
  //   //TODO: make parallel promise request here (breaks tcp layer for some odd reason)
  //
  //   for (let topic of Object.keys(subscribers)) {
  //
  //     results[topic] = 0;
  //
  //     for (let edge of subscribers[topic].edges) {
  //
  //       var message = protocol.createMessage('subscription-publish', {
  //         topic: topic,
  //         message: publishMessage.data.payload,
  //         queryPeer: subscribers[topic].queryPeer//introduced so we can decentralise back-pressure on stale client subscriptions
  //       });
  //
  //       var response = await this.edge.cluster.request(edge, message);
  //       results[response.payload.response.topic] += response.payload.response.emitted;
  //     }
  //   }
  //
  //   return results;
  // }

  //this causes a catastrophic error with TCP socket or something

  // async postSubscriptions(subscribers, publishMessage) {
  //
  //   var results = {};
  //
  //   var failures = [];
  //
  //   var promises = [];
  //
  //   for (let topic of Object.keys(subscribers)) {
  //
  //     results[topic] = 0;
  //
  //     for (let edge of subscribers[topic].edges) {
  //
  //       var message = protocol.createMessage('subscription-publish', {
  //         topic: topic,
  //         message: publishMessage.data.payload,
  //         queryPeer: subscribers[topic].queryPeer//introduced so we can decentralise back-pressure on stale client subscriptions
  //       });
  //
  //       promises.push(this.edge.cluster.request(edge, message));
  //     }
  //   }
  //
  //   var responses = await Promise.all(promises);
  //
  //   responses.forEach(function (response, i) {
  //
  //     if (response.payload.status == 1) results[response.payload.response.topic] += response.payload.response.emitted;
  //     else failures.push(response.payload);
  //   });
  //
  //   //TODO: error needs to contain failures
  //   if (failures.length > 0) {
  //     throw new Error('failed to fetch edges');
  //   }
  //
  //   return results;
  // }

  async querySubscriptions(possibleTopics) {

    var subscribers = {};

    var failures = [];

    var promises = [];

    for (let topic of possibleTopics) {

      var [subscriptionPeer] = this.edge.hashring.listMembers(topic);

      var message = protocol.createMessage('edges', {topic: topic});

      promises.push(this.edge.cluster.request(subscriptionPeer, message));

      subscribers[topic] = {queryPeer: subscriptionPeer};
    }

    var responses = await Promise.all(promises);

    responses.forEach(function (response, i) {
      if (response.payload.status == 1)
        subscribers[possibleTopics[i]].edges = response.payload.response;
      else failures.push(response.payload);
    });

    //TODO: error needs to contain failures
    if (failures.length > 0) throw new Error('failed to fetch edges');

    return subscribers;
  }

  async process(message) {

    var possibleTopics = this.getWildcardPermutations(message.data.payload.topic);

    var subscribers = await this.querySubscriptions(possibleTopics);

    return await this.postSubscriptions(subscribers, message);
  }
};