const hyperid = require('hyperid');
const utils = require('./utils');

module.exports = class Protocol {

  constructor() {

  }

  createMessage(action, payload, options, clone) {

    var message = {
      tx: hyperid(),
      time: Date.now()
    };

    message.action = action;
    message.options = options;

    if (clone) message.payload = utils.clone(payload);

    return message;
  }
};