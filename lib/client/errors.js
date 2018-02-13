const constants = require('../common/constants');

module.exports = {

  ConfigError: class ClientError extends Error {

    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.CLIENT.CONFIG_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },
  ConnectError: class ClientError extends Error {

    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.CLIENT.CONNECT_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },
  DisconnectedWriteError: class ClientError extends Error {

    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.CLIENT.DISCONNECTED_WRITE;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },
  Error: class ClientError extends Error {

    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.CLIENT.ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },
  TimeoutError: class ClientError extends Error {

    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.CLIENT.TIMEOUT_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  }
};


class ClientError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}
