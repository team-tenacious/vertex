const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../../../errors');
const CONSTANTS = require('../../../../common/constants');

module.exports = class ErrorHandler extends EventEmitter {

  static get dependants() {
    return [];
  }

  constructor(edge) {
    super();
    this.edge = edge;
  }

  process(message){

  }
};
