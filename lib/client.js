EventEmitter = require('events').EventEmitter;

module.exports = class Client extends EventEmitter {

  constructor(config, inject) {

    super();

    if (!inject) inject = {};

    this.CONSTANTS = require('./common/constants');
    this.ClientError = require('./client/errors');

    if (inject.Connection) this.Connection = inject.Connection; else this.Connection = require('./client/connection');
    if (inject.utils) this.utils = inject.utils; else this.utils = require('./common/utils');
    if (inject.Protocol) this.Protocol = inject.Protocol; else this.Protocol = require('./common/protocol');

    this.subscriptions = {};
    this.STATE = this.CONSTANTS.CLIENT_STATE.UNINITIALIZED;
    this.protocol = new this.Protocol();
    this.receiveHandlers = {};
    this.config = this.setupConfig(config);
  }

  setupConfig(config) {

    if (!config) config = {};
    else config = this.utils.clone(config);

    if (!config.url) throw new this.ClientError('URI needs to be specified for client connection', this.CONSTANTS.ERRORS.CLIENT.CONNECT_BAD_URI);
    if (!config.connectionAttemptInterval) config.connectionAttemptInterval = 5000;
    if (!config.connectionOptions) config.connectionOptions = {};

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

    if (!options) options = {code: 1, reason: 'intentional disconnect'};

    this.emitEvent('disconnect-attempt', options);

    if (this.STATE == this.CONSTANTS.CLIENT_STATE.CONNECTED) return this.connection.close(options.code, options.reason);
  }

  receive(message) {

    if (message.action == 'notify') return this.receiveSubscription(message);
    this.receiveResponse(message);
  }

  receiveSubscription(message) {

    Object.keys(this.subscriptions[message.topic].handlers).forEach((handler) => {
      try {
        handler(message.payload);
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
      this.receiveHandlers[message.tx](message);
    } catch (e) {
      this.emitEvent('error', {reason: 'response received handler failed', message: message, error: e});
    }

    delete this.receiveHandlers[message.tx];
  }

  async writeMessage(message, handler) {

    if (this.STATE != this.CONSTANTS.CLIENT_STATE.CONNECTED) throw new this.ClientError('Attempt to write when client disconnected', this.CONSTANTS.ERRORS.CLIENT.DISCONNECTED_WRITE);

    this.receiveHandlers[message.tx] = {
      handler: handler
    };

    this.receiveHandlers[message.tx].timeout = setTimeout(function () {
      this.handler(new this.ClientError('message timed out', this.CONSTANTS.ERRORS.CLIENT.RESPONSE_TIMEOUT, this.message))
    }.bind({handler: handler, message: message}));

    this.connection.send(message);
  }

  attemptConnection() {

    this.emitEvent('connection-attempt', {url: this.config.url, options: this.config.connectionOptions});

    var connection = new this.Connection();

    connection.connect(this.config.url, this.config.connectionOptions)
      .then(() => {
        this.connection = connection;
        this.connection.on('message', this.receive.bind(this));
        this.connection.on('close', (info) => {
          this.emitEvent('close', info);
        });
        this.connection.on('error', (info) => {
          this.emitEvent('error', info);
        });
        this.STATE = this.CONSTANTS.CLIENT_STATE.CONNECTED;
        this.emitEvent('connected', this.connection);
      })
      .catch((e) => {
        this.emitEvent('error', {reason: 'connection attempt failed', config: this.config, error: e});
      })
  }

  connectLoop() {

    if (this.STATE == this.CONSTANTS.CLIENT_STATE.CONNECTED && this.connection.url == this.config.url) return;

    if (this.STATE == this.CONSTANTS.CLIENT_STATE.CONNECTING) return;

    this.STATE = this.CONSTANTS.CLIENT_STATE.CONNECTING;

    this.attemptConnection();

    setTimeout(()=> {

      while (this.STATE == this.CONSTANTS.CLIENT_STATE.CONNECTING) {
        setTimeout(this.attemptConnection, this.config.connectionAttemptInterval);
      }
    }, this.config.connectionAttemptInterval);
  }

  async unsubscribe(subscription, options) {

    if (!this.subscriptions[subscription.topic]) return;

    this.subscriptions[subscription.topic].refCount--;
    delete this.subscriptions[subscription.topic].handlers[subscription.tx];

    if (this.subscriptions[subscription.topic].refCount == 0) {
      var unsubscription = this.protocol.createMessage('unsubscribe', subscription, options);
      await this.writeMessage(unsubscription);
    }

    return subscription;
  }

  async subscribe(topic, handler) {

    var subscription = this.protocol.createMessage('subscribe', {topic: topic}, options);

    if (!this.subscriptions[topic]) {

      this.subscriptions[topic] = {
        handlers: {},
        refCount: 0
      };

      await this.writeMessage(subscription, handler);
    }

    this.subscriptions[topic].refCount++;
    this.subscriptions[topic].handlers[subscription.tx] = handler;

    return subscription;
  }

  async publish(topic, data, options) {

    await this.writeMessage(this.protocol.createMessage('publish', {topic: topic, data: data}, options));
  }

  emitEvent(key, data) {

    this.emit(key, data);
    this.emit('all', {key: key, data: data});
  }
};