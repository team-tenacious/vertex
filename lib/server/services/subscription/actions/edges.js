const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class EdgesHandler extends EventEmitter {

  static create(subscriptionService) {
    return new EdgesHandler(subscriptionService);
  }

  constructor(subscriptionService) {
    super();
    this.subscriptionService = subscriptionService;
  }

  async process(originAddress, message){

    var edgesObj = await this.subscriptionService.cache.get(message.payload.topic);

    if (!edgesObj)  return [];

    var edges = [];

    Object.keys(edgesObj).forEach(function(edgeAddr){

      if (edgesObj[edgeAddr]) edges.push(edgeAddr);
    });

    return edges;
  }
};