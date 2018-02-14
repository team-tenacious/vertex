const { Socket } = require('net');
const { EventEmitter } = require('events');
const JsonSocket = require('json-socket');
const Protocol = require('../../../common/protocol');
const { ServerUnconnectedSocketError, ServerJoinError } = require('../../errors');

module.exports = class Peer extends EventEmitter {

  constructor(logger, opts) {
    super();
    this.logger = logger;
    this.name = opts.name;
    this.self = opts.self;
    this.address = opts.address;

    this.protocol = new Protocol();

    this.socket = opts.socket;
    this.jsonSocket = opts.jsonSocket;

    if (this.socket) {
      this.socket.once('close', this.onClose.bind(this));
    }

    if (this.jsonSocket) {
      this.jsonSocket.on('message', message => this.emit('message', message));
    }

  }

  connect(myName, myAddress, secret) {
    return new Promise((resolve, reject) => {
      if (this.self) return resolve(); // no connect to self

      this.logger.debug('connecting to %s', this.address);

      var [host, port] = this.address.split(':');
      port = parseInt(port);

      this.socket = new Socket();
      this.socket.connect(port, host);
      this.socket.once('error', reject);
      this.socket.once('connect', () => {
        this.onConnect(myName, myAddress, secret, resolve, reject);
      });
    });
  }

  write(message) {
    return new Promise((resolve, reject) => {
      if (this.self) {
        this.emit('message', message);
        return resolve();
      }

      if (!this.jsonSocket) {
        reject(new ServerUnconnectedSocketError('Not connected to ' + this.address));
      }

      this.jsonSocket.sendMessage(message, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  onConnect(myName, myAddress, secret, resolve, reject) {
    this.socket.removeAllListeners('error');

    this.jsonSocket = new JsonSocket(this.socket);

    this.socket.on('error', this.onSocketError.bind(this));
    this.jsonSocket.on('error', this.onJsonSocketError.bind(this));

    this.socket.once('close', () => {
      reject(new ServerJoinError('Closed connection to ' + this.address));
    });

    this.jsonSocket.on('message', message => {

      if (message.action == 'join-ack') {
        this.socket.removeAllListeners('close');
        this.socket.once('close', this.onClose.bind(this));
        this.name = message.payload.name;
        resolve(message.payload.peers);
        return;
      }

      this.emit('message', message);

    });

    var action = 'join';
    var options = {};
    var payload = {
      name: myName,
      address: myAddress,
      secret: secret
      // TODO: inform other that this is edge-only node etc.
    }
    var message = this.protocol.createMessage(action, payload, options);

    this.write(message).catch(reject);
  }

  onClose() {
    if (this.socket) {
      this.socket.removeAllListeners('error');
    }
    if (this.jsonSocket) {
      // TODO: unsubscribe all in jsonSocket
      // this.jsonSocket.removeAllListeners('error');
    }
    this.logger.debug('disconnection from', this.address);
    this.emit('close');
  }

  onSocketError(err) {
    // TODO: what to do?
    this.logger.error('socket error on %s', this.address, err);
  }

  onJsonSocketError(err) {
    // TODO: what to do?
    this.logger.error('json socket error on %s', this.address, err);
  }

}
