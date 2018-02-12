module.exports = class Membership {

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
  }

  async start() {
    this.logger.info('starting');
  }

}
