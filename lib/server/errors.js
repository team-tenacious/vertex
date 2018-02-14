const constants = require('../common/constants');

module.exports = {

  ServerConfigError: class ServerConfigError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.SERVER.CONFIG_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },

  ServerJoinError: class ServerJoinError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.SERVER.JOIN_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },

  ServerUnconnectedSocketError: class ServerUnconnectedSocketError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.SERVER.UNCONNECTED_SOCKET_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  },

  NoSuchPeerError: class NoSuchPeerError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      this.code = constants.ERRORS.SERVER.NO_SUCH_PEER_ERROR;
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = (new Error(message)).stack;
      }
    }
  }


}
