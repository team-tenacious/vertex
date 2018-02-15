const Hyperid = require('hyperid');
const hyperid = new Hyperid();
const utils = require('./utils');

module.exports = class Protocol {

  static create() {
    return new Protocol();
  }

  constructor() {

  }

  createMessage(action, payload, options, clone) {

    var message = {
      tx: hyperid(),
      ts: Date.now()
    };

    message.action = action;
    message.options = options;

    if (clone) message.payload = utils.clone(payload);
    else message.payload = payload;

    return message;
  }

  createReply(request, payload) {

    return {
      tx: request.tx,
      ts: Date.now(),
      action: request.action + '-reply',
      payload: payload
    };
  }

  serializeError(e) {
    return e.toString()
  }
};
