const { Socket } = require('net');
const JsonSocket = require('json-socket');
const { ServerUnconnectedSocketError, ServerJoinError } = require('../../errors');

module.exports = class Peer {

  constructor(logger, opts) {
    this.logger = logger;
    this.self = opts.self;
    this.advertiseAddress = opts.advertiseAddress;
    this.address = opts.address;
    this.key = opts.key;

    this.socket = opts.socket;
    this.jsonSocket = opts.jsonSocket;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.self) return resolve(); // no connect to self

      this.logger.debug('connecting to %s', this.address);

      var [host, port] = this.address.split(':');
      port = parseInt(port);

      this.socket = new Socket();
      this.socket.connect(port, host);
      this.socket.once('error', reject);
      this.socket.once('connect', () => {
        this.onConnect(resolve, reject);
      });
    });
  }

  write(message) {
    return new Promise((resolve, reject) => {
      if (this.self) {
        reject(new Error('unimplemented'));
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

  onConnect(resolve, reject) {
    this.socket.removeAllListeners('error');

    this.jsonSocket = new JsonSocket(this.socket);

    this.socket.on('error', this.onSocketError.bind(this));
    this.jsonSocket.on('error', this.onJsonSocketError.bind(this));

    this.socket.once('close', () => {
      reject(new ServerJoinError('Closed connection to ' + this.address));
    });

    this.jsonSocket.on('message', message => {

      if (message.action == 'join-ack') {
        console.log('MM', message.payload.peers);
        resolve(message.payload.peers);
      }

    });

    this.write({
        action: 'join',
        options: {
          // eg. as edge only node, etc
        },
        payload: {
          address: this.advertiseAddress,
          key: this.key
        }
      })

      .catch(reject);
  }

  onSocketError(err) {
    // TODO: what to do?
    this.logger.error('socket error on %s', this.address, err);
  }

  onJsonSocketError(err) {
    // TODO: what to do?
    this.logger.error('socket error on %s', this.address, err);
  }

}
