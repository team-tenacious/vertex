const {Peer} = require('./cluster/peer');

module.exports = class Cluster {

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
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

}
