const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class PublishHandler extends EventEmitter {

  static create(edge) {
    return new PublishHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  process(message){

  }
};