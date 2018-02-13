const {Peer} = require('./cluster/peer');
const {ServerConfigError} = require('../errors');

module.exports = class Cluster {

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
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
    for (var address of this.config.join) {
      console.log('address', address);
    }
  }

  defaults() {
    if ('boolean' !== typeof this.config.seed) {
      this.config.seed = false;
    }
  }

  validate() {
    if(!Array.isArray(this.config.join)) {
      throw new ServerConfigError('Missing cluster.join');
    }

    if(this.config.join.length < 1) {
      throw new ServerConfigError('Empty cluster.join');
    }
  }

}
