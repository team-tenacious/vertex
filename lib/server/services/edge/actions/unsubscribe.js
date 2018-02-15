const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class UnsuscribeHandler extends EventEmitter {

  static create(edge) {
    return new UnsuscribeHandler(edge);
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  process(message){

  }
};