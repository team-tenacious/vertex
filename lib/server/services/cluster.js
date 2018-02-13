const Peer = require('./cluster/peer');
const { EventEmitter } = require('events');

const {
  ServerConfigError,
  ServerJoinError
} = require('../errors');

module.exports = class Cluster extends EventEmitter {

  constructor(server, logger, config) {
    super();
    this.services = server.services;
    this.logger = logger;
    this.config = config;
    this.peers = {};
    this.defaults();
    this.validate();
  }

  async start() {
    this.logger.info('starting');
    await this.connectToPeers();
  }

  async stop() {
    this.logger.info('stopping');
  }

  async connectToPeers() {
    this.logger.error('>>>>>>>TODO: add self to join list');
    var joining = JSON.parse(JSON.stringify(this.config.join));
    var address;

    while (address = joining.shift()) {
      // learns more peers with each join
      var peerAddresses = await this.connectToPeer(address);
      this.logger.error('>>>>>>TODO: further joins', peerAddresses);
    }

    if (!this.config.seed) {
      if (Object.keys(this.peers).length < 2) {
        // non seed cluster peer cannot join only to self
        throw new ServerJoinError('No other peers');
      }
    }

    // connected to all known peers
    this.emit('stable');
  }

  async connectToPeer(address) {
    var peer = new Peer(this.logger, {
      self: address == this.services.tcp.advertiseAddress,
      advertiseAddress: this.services.tcp.advertiseAddress,
      address: address,
      key: this.services.tcp.config.key
    });

    try {
      await peer.connect();
      if (!peer.self) {
          this.services.sockets.add(peer.socket);
      }
      this.peers[address] = peer;
      this.emit('joined', address);
    } catch (e) {
      this.logger.warn(e);
    }
  }

  addPeer(opts) {
    var peer = new Peer(this.logger, {
      self: opts.address == this.services.tcp.advertiseAddress,
      advertiseAddress: this.services.tcp.advertiseAddress,
      address: opts.address,
      socket: opts.socket,
      jsonSocket: opts.jsonSocket
    });

    this.emit('joined', opts.address);

    return peer;
  }

  listPeers() {
    return Object.keys(this.peers).sort();
  }

  defaults() {
    if ('boolean' !== typeof this.config.seed) {
      this.config.seed = false;
    }
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
