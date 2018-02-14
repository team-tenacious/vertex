const Peer = require('./cluster/peer');
const { EventEmitter } = require('events');
const { clone, pause } = require('../../common/utils');

const {
  ServerConfigError,
  ServerJoinError
} = require('../errors');

module.exports = class Cluster extends EventEmitter {

  static get dependancies() { return ['sockets']; }

  constructor(server, logger, config) {
    super();
    this.name = server.name;
    this.services = server.services;
    this.logger = logger;
    this.config = config;
    this.peers = {};
    this.defaults();
    this.validate();

    this.advertiseAddress = null; // set by tcp service
  }

  get clusterSize() { return Object.keys(this.peers).length; }

  async start() {
    this.logger.info('starting');
    await this.connectToPeers();
  }

  async stop() {
    this.logger.info('stopping');
  }

  async connectToPeers() {
    var joining = clone(this.config.join);
    var address;

    // pause to wait for seed node to start,
    // useful when starting multiple nodes concurrrently
    if (!this.config.seed) await pause(this.config.joinWait);

    this.connectToSelf();

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

    try {
      // connect responds with more peers to join
      // as known by the remote peer connected to
      var peerAddresses = await peer.connect(this.name, this.advertiseAddress, this.config.secret);
      this.join(address, peer);

      if (peer.self) return [];

      this.services.sockets.add(peer.socket);
      return peerAddresses;

    } catch (e) {
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

  listPeers() {
    return Object.keys(this.peers).sort();
  }

  join(address, peer) {
    if (this.peers[address]) {
      this.logger.error('peer %s already joined', address);
      return;
    }
    this.peers[address] = peer;
    this.logger.info('size %d - %s (%s) joined', this.clusterSize, peer.name, peer.address);
    this.emit('joined', address);
  }

  defaults() {
    if (!this.config.secret) {
      this.logger.warn('using default cluster connection secret');
      this.config.secret = 'secret';
    }

    if ('boolean' !== typeof this.config.seed) {
      this.config.seed = false;
    }

    this.config.joinWait = this.config.joinWait || 0;
  }

  validate() {
    if (!Array.isArray(this.config.join)) {
      throw new ServerConfigError('Missing cluster.join');
    }

    if (this.config.join.length < 1) {
      throw new ServerConfigError('Empty cluster.join');
    }
  }

}
