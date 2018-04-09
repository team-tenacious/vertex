const Peer = require('./cluster/peer');
const { EventEmitter } = require('events');
const Hyperid = require('hyperid');
const hyperid = new Hyperid();
const Protocol = require('../../common/protocol');
const { clone, pause } = require('../../common/utils');
const {
  NoSuchPeerError,
  RequestTimeoutError,
  RequestToDepartedError
} = require('../errors');

const {
  ServerConfigError,
  ServerJoinError
} = require('../errors');

module.exports = class Cluster extends EventEmitter {

  static get dependants() { return ['hashring', 'tcp', 'edge', 'subscription']; }

  constructor(server, logger, config) {
    super();
    this.name = server.name;
    this.sockets = server.services.sockets;
    this.logger = logger;
    this.config = config;

    this.peers = {};
    this.connections = {};
    this.requests = {};

    this.advertiseAddress = null; // set by tcp service
    this.protocol = new Protocol();

    this.defaults();
    this.validate();
  }

  get clusterSize() { return Object.keys(this.peers).length; }

  async start() {
    this.logger.info('starting');
    await this.connectToPeers();
  }

  async stop() {
    this.logger.info('stopping');
    for (var txId in this.requests) {
      clearTimeout(this.requests[txId].timeout);
      delete this.requests[txId];
    }
  }

  listPeers() {
    return Object.keys(this.peers).sort();
  }

  async write(toAddress, message) {

    var peer = this.peers[toAddress];
    if (!peer) throw new NoSuchPeerError('cannot write to ' + toAddress);
    return await peer.write(message);
  }

  request(toAddress, message) {

    return new Promise((resolve, reject) => {

      message.tx = message.tx || hyperid();

      var timeout = setTimeout(() => {

        delete this.requests[message.tx];
        reject(new RequestTimeoutError('Called request did not reply in time'));

      }, this.config.requestTimeout);

      this.requests[message.tx] = {
        resolve: resolve,
        reject: reject,
        timeout: timeout,
        toAddress: toAddress
      };

      this.write(toAddress, message)
          .catch(reject);
    });
  }

  async connectToPeers() {
    var joining = clone(this.config.join);
    var address;

    // pause to wait for seed node to start,
    // useful when starting multiple nodes concurrrently
    if (!this.config.seed) await pause(this.config.joinWait);

    this.connectToSelf();

    if (this.config.seed && joining.length == 0) return this.emit('stable');

    // remove self from join list
    var offset = joining.indexOf(this.advertiseAddress);
    if (offset >= 0) joining.splice(offset, 1);

    while (address = joining.shift()) {
      // learns more peers with each join
      var peerAddresses = await this.connectToPeer(address);
      this.logger.debug('further joins', peerAddresses);
      peerAddresses.forEach(address => {
        // only add unknown addresses to the join list
        if (joining.indexOf(address) >= 0) return;
        if (this.peers[address]) return;
        joining.push(address);
      });
    }

    if (!this.config.seed) {
      if (Object.keys(this.peers).length < 2) {
        // non seed node cannot join only to self
        throw new ServerJoinError('No other peers');
      }
    }

    // connected to all known peers
    this.emit('stable');
  }

  async connectToSelf() {
    var peer = new Peer(this.logger, {
      self: true,
      name: this.name,
      address: this.advertiseAddress
    });

    this.join(peer.address, peer);
  }

  async connectToPeer(address) {
    var peer = new Peer(this.logger, {
      self: address == this.advertiseAddress,
      address: address,
    });

    this.connections[address] = true;

    try {
      // connect responds with more peers to join
      // as known by the remote peer connected to
      var peerAddresses = await peer.connect(this.name, this.advertiseAddress, this.config.secret);
      this.join(address, peer);

      this.sockets.add(peer.socket);
      return peerAddresses;

    } catch (e) {
      delete this.connections[address];
      this.logger.warn(e);
      return [];
    }
  }

  addPeer(opts) {
    var peer = new Peer(this.logger, {
      name: opts.name,
      self: opts.address == this.advertiseAddress,
      address: opts.address,
      socket: opts.socket,
      jsonSocket: opts.jsonSocket
    });

    this.join(opts.address, peer);

    return peer;
  }

  gotConnection(address) {
    return this.connections[address] == true;
  }

  handleJoinMessage(opts) {
    var peer, peers, action, options, payload, reply;
    var { message, socket, jsonSocket } = opts;
    var { remoteAddress, remotePort } = socket;

    if (!message.payload) {
      this.logger.error('Missing join payload from %s:%s', remoteAddress, remotePort);
      return socket.end();
    }

    if (!message.payload.secret) {
      this.logger.error('Missing join secret from %s:%s', remoteAddress, remotePort);
      return socket.end();
    }

    if (message.payload.secret != this.config.secret) {
      this.logger.error('Wrong join secret from %s:%s', remoteAddress, remotePort);
      return socket.end();
    }

    if (!message.payload.address) {
      this.logger.error('Missing join address from %s:%s', remoteAddress, remotePort);
      return socket.end();
    }

    if (this.gotConnection(message.payload.address)) {
      // two nodes connecting to each other simultaneously
      // only keep one of the sockets
      this.logger.warn('%s (%s) duplicate socket', message.payload.name, message.payload.address);

      var first = [this.advertiseAddress, message.payload.address].sort().pop();

      if (first != this.advertiseAddress) {
        return socket.end();
        // action = 'join-duplicate';
        // options = {};
        // payload: {};
        // reply = this.protocol.createMessage(action, payload, options);
        //
        // return jsonSocket.sendEndMessage(reply, err => {
        //   if (err) this.logger.error('write error', err);
        // });
      }
    }

    peer = this.addPeer({
      name: message.payload.name,
      address: message.payload.address,
      socket: socket,
      jsonSocket: jsonSocket
    });

    peers = this.listPeers();

    action = 'join-ack';
    options = {};
    payload = {
      name: this.name,
      peers: peers
    };
    // TODO: implement working reply: this has new tx id and probably shouldn't
    reply = this.protocol.createMessage(action, payload, options);

    peer.write(reply).catch(err => {
      this.logger.error('write error', err);
    });
  }

  join(address, peer) {
    this.connections[address] = true;

    if (this.peers[address]) {
      this.logger.error('peer %s (%s) already joined', peer.name, address);
      return;
    }

    peer.on('message', message => {

      if (!this.requests.hasOwnProperty(message.tx) || message.action.indexOf('-reply') == -1) {
        this.emit('message', peer.address, message);
        return;
      }

      var {resolve, reject, timeout, toAddress} = this.requests[message.tx];
      clearTimeout(timeout);
      delete this.requests[message.tx];

      resolve(message);
    });

    this.peers[address] = peer;
    this.logger.info('size %d - %s (%s) joined', this.clusterSize, peer.name, peer.address);
    this.emit('join', address);

    peer.once('close', () => {
      delete this.connections[address];
      delete this.peers[address];
      peer.removeAllListeners('message');
      this.logger.info('size %d - %s (%s) left', this.clusterSize, peer.name, peer.address);

      // emit leave before failing requests so that hashring service
      // is ready/updated before requests reject.
      this.emit('leave', address);

      for (var txId in this.requests) {
        if (this.requests[txId].toAddress == address) {
          var {resolve, reject, timeout, toAddress} = this.requests[txId];
          delete this.requests[txId];
          clearTimeout(timeout);
          reject(new RequestToDepartedError('Remote peer shut down before replying'));
        }
      }
    });
  }

  defaults() {
    if (!this.config.secret) {
      this.logger.warn('using default cluster connection secret');
      this.config.secret = 'secret';
    }

    if ('number' !== typeof this.config.requestTimeout) {
      this.config.requestTimeout = 120 * 1000;
    }

    if ('boolean' !== typeof this.config.seed) {
      this.config.seed = false;
    }

    this.config.joinWait = this.config.joinWait || 0;
  }

  validate() {

    if (this.config.seed) return;//seed node doesnt need to join anything

    if (!Array.isArray(this.config.join)) {
      throw new ServerConfigError('Missing cluster.join');
    }

    if (this.config.join.length < 1) {
      throw new ServerConfigError('Empty cluster.join');
    }
  }

}
