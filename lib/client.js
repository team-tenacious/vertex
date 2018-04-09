const EventEmitter = require('events').EventEmitter;
const ClientError = require('./client/errors');
const CONSTANTS = require('./common/constants');

module.exports = class Client extends EventEmitter {

  constructor(config, inject) {

    super();

    if (!inject) inject = {};

    if (inject.Connection) this.Connection = inject.Connection; else this.Connection = require('./client/connection');
    if (inject.utils) this.utils = inject.utils; else this.utils = require('./common/utils');
    if (inject.Protocol) this.Protocol = inject.Protocol; else this.Protocol = require('./common/protocol');

    this.subscriptions = {};
    this.STATE = CONSTANTS.CLIENT_STATE.UNINITIALIZED;
    this.protocol = new this.Protocol();
    this.receiveHandlers = {};
    this.config = this.setupConfig(config);
    this.connectionInfo = null;
  }

  setupConfig(config) {

    if (!config) config = {};
    else config = this.utils.clone(config);

    if (!config.url) throw new ClientError.ConfigError('URI needs to be specified for client connection', CONSTANTS.ERRORS.CLIENT.CONNECT_BAD_URI);
    if (!config.connectionAttemptInterval) config.connectionAttemptInterval = 5000;
    if (!config.connectionOptions) config.connectionOptions = {};
    if (!config.callTimeout) config.callTimeout = 120000;// 2 inutes

    return config;
  }

  connect(config) {

    if (config) {
      if (config.url) this.config.url = config.url;
      if (config.connectionAttemptInterval) this.config.connectionAttemptInterval = config.connectionAttemptInterval;
    }

    return this.connectLoop();
  }

  disconnect(options) {

    if (!options) options = {code: CONSTANTS.WS_CLOSE_REASON.NORMAL, reason: 'intentional disconnect'};

    this.emitEvent('disconnect-attempt', options);

    if (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTED) return this.connection.close(options.code, options.reason);
  }

  receive(message) {

    if (message.action == 'publish') return this.receiveSubscription(message);
    if (message.action == 'connection-confirmed') return this.receiveConnectionConfirmation(message);
    this.receiveResponse(message);
  }

  receiveConnectionConfirmation(message){

    this.connectionInfo = message.payload;

    if (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTED) return this.emitEvent('connection-confirmed', message.payload);

    var connectedChecks = 20;

    var interval = setInterval(() => {

      if (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTED) {
        this.emitEvent('connection-confirmed', message.payload);
        clearInterval(interval);
      }

      connectedChecks--;

      if (connectedChecks == 0) {
        this.disconnect();
        this.emitEvent('error', new Error('connection-confirmed but open event never happened'));
      }

    }, 1000);
  }

  receiveSubscription(message) {

    Object.keys(this.subscriptions[message.payload.topic].handlers).forEach((handlerKey) => {
      try {
        this.subscriptions[message.payload.topic].handlers[handlerKey](message.payload.data);
      } catch (e) {
        this.emitEvent('error', {reason: 'message handler failed', message: message, error: e});
      }
    });
  }

  receiveResponse(message) {

    // all other messages are responses
    if (!this.receiveHandlers[message.tx]) return this.emit('error', {
      reason: 'timed out server message',
      message: message
    });

    clearTimeout(this.receiveHandlers[message.tx].timeout);

    try {

      if (message.payload.status == 0) return this.receiveHandlers[message.tx].handler(new Error(message.payload.error));

      this.receiveHandlers[message.tx].handler(null, message);
    } catch (e) {
      this.emitEvent('error', {reason: 'response received handler failed', message: message, error: e});
    }

    delete this.receiveHandlers[message.tx];
  }

  writeMessage(message) {

    return new Promise((resolve, reject) => {

      if (this.STATE != CONSTANTS.CLIENT_STATE.CONNECTED) throw new ClientError.ConnectError('Attempt to write when client disconnected', CONSTANTS.ERRORS.CLIENT.DISCONNECTED_WRITE);

      this.receiveHandlers[message.tx] = {
        handler: (e, data) => {

          delete this.receiveHandlers[message.tx];

          if (e) return reject(e);
          resolve(data);
        }
      };

      this.receiveHandlers[message.tx].timeout = setTimeout(() => {

        reject(new ClientError.TimeoutError('message timed out', CONSTANTS.ERRORS.CLIENT.RESPONSE_TIMEOUT, message));
        delete this.receiveHandlers[message.tx];

      }, this.config.callTimeout);

      this.connection.send(message);
    });
  }

  attemptConnection() {

    this.emitEvent('connection-attempt', {url: this.config.url, options: this.config.connectionOptions});

    var connection = new this.Connection();

    connection.on('message', (message) => {
      this.receive(message);
    });

    connection.on('close', (info) => {
      this.emitEvent('close', info);
    });

    connection.on('error', (info) => {
      this.emitEvent('error', info);
    });

    connection.connect(this.config.url, this.config.connectionOptions)
      .then(() => {
        this.connection = connection;
        this.STATE = CONSTANTS.CLIENT_STATE.CONNECTED;
        this.emitEvent('connected', this.connection);
      })
      .catch((e) => {
        this.emitEvent('error', {reason: 'connection attempt failed', config: this.config, error: e});
      })
  }

  connectLoop() {

    if (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTED && this.connection.url == this.config.url) return;

    if (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTING) return;

    this.STATE = CONSTANTS.CLIENT_STATE.CONNECTING;

    this.attemptConnection();

    setTimeout(()=> {

      while (this.STATE == CONSTANTS.CLIENT_STATE.CONNECTING) {
        setTimeout(this.attemptConnection, this.config.connectionAttemptInterval);
      }
    }, this.config.connectionAttemptInterval);
  }

  async unsubscribe(subscription, options) {

    if (!this.subscriptions[subscription.payload.topic]) return;

    this.subscriptions[subscription.payload.topic].refCount--;
    delete this.subscriptions[subscription.payload.topic].handlers[subscription.tx];

    if (this.subscriptions[subscription.payload.topic].refCount == 0)
      await this.writeMessage(this.protocol.createMessage('unsubscribe', {topic:subscription.payload.topic}, options));

    return subscription;
  }

  async subscribe(topic, options, handler) {

    if (typeof options == 'function') {
      handler = options;
      options = null;
    }

    if (!options) options = {};

    var subscription = this.protocol.createMessage('subscribe', {topic: topic}, options);

    if (!this.subscriptions[topic]) {

      this.subscriptions[topic] = {
        handlers: {},
        refCount: 0
      };

      await this.writeMessage(subscription);
    }

    this.subscriptions[topic].refCount++;
    this.subscriptions[topic].handlers[subscription.tx] = handler;

    return subscription;
  }

  publish(topic, data, options) {

    return this.writeMessage(this.protocol.createMessage('publish', {topic: topic, data: data}, options));
  }

  emitEvent(key, data) {

    this.emit(key, data);
    this.emit('all', {key: key, data: data});
  }
};