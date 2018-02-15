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

  async process(message){

    var [subscriptionPeer] = this.edge.hashring.listMembers(message.data.payload.topic);
    await this.edge.cluster.request(subscriptionPeer, message);
  }

};