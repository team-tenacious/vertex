const VertexLogger = require('vertex-logger');
const VertexNames = require('vertex-names');

const serviceOrder = [
  'sockets',
  'tcp',
  'cluster'
];

module.exports = class Server {

  static async create(config) {
    const server = new Server(config);
    return await server.start();
  }

  constructor(config = {}) {
    this.name = config.name || this.createName();
    this.config = config;
    this.config.services = this.config.services || {};
    this.logger = new VertexLogger({
      root: this.name,
      name: 'server',
      level: this.config.logger ? this.config.logger.level : 'info'
    });
    this.services = {};
  }

  async start() {
    this.logger.info('starting');
    try {
      await this.startServices();
      return this;
    } catch (e) {
      this.logger.error('starting failed', e);
      throw e;
    }
  }

  async stop() {
    this.logger.info('stopping');
    for (var serviceName in this.services) {
      await this.services[serviceName].stop();
    }
    return this;
  }

  async startServices() {
    var sorted = this.sortServices();
    for (var serviceName of sorted) {
      this.logger.info('creating service: %s', serviceName);

      var logger = this.logger.createLogger({ name: serviceName });
      var config = this.config.services[serviceName];
      var path = config.path || `./server/services/${serviceName}`;
      var Service = require(path);
      this.services[serviceName] = new Service(this, logger, config);
    }

    for (var serviceName of sorted) {
      await this.services[serviceName].start();
    }
  }

  createName() {
    return VertexNames.createWord(8, { finished: true });
  }

  sortServices() {
    var services = [];
    serviceOrder.forEach(serviceName => {
      this.config.services[serviceName] = this.config.services[serviceName] || {};
      services.push(serviceName);
    });

    for (var serviceName in this.config.services) {
      if (services.indexOf(serviceName) >= 0) continue;
      services.push(serviceName);
    }

    return services;
  }

}
