module.exports = class Tcp {

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
  }

  async start() {
    this.logger.info('starting');
  }

}
