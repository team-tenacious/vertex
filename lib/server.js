const VertexLogger = require('vertex-logger');
const VertexNames = require('vertex-names');
const DAGMap = require("dag-map").default;

const serviceStartOrder = [
  'tcp',
  'cluster',
  'hashring',
  'http',
  'ws'
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
    this.defaults();
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
      this.instantiateServices();
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
      if (this.services[serviceName].stop)
        await this.services[serviceName].stop();
    }
    return this;
  }

  instantiateServices() {

    this.dependancyMap = new DAGMap();

    Object.keys(this.config.services).forEach(serviceName => {
      var config = this.config.services[serviceName];
      var path = config.path || `./server/services/${serviceName}`;
      var Service = require(path);
      this.dependancyMap.add(serviceName, Service, Service.dependancies || [])
    });

    this.dependancyMap.each((serviceName, serviceClass) => {

      this.logger.info('creating service: %s', serviceName);

      var logger = this.logger.createLogger({ name: serviceName });
      var config = this.config.services[serviceName];

      this.services[serviceName] = new serviceClass(this, logger, config);
    });
  }

  async startServices() {
    var sorted = this.sortServices();

    for (var serviceName of sorted) {
      if (this.services[serviceName].start)
        await this.services[serviceName].start();
    }
  }

  createName() {
    return VertexNames.createWord(11, { finished: true });
  }

  sortServices() {

    var services = [];

    serviceStartOrder.forEach(serviceName => {
      this.config.services[serviceName] = this.config.services[serviceName] || {};
      services.push(serviceName);
    });

    for (var serviceName in this.config.services) {
      if (services.indexOf(serviceName) >= 0) continue;
      services.push(serviceName);
    }

    return services;
  }

  defaults(){
    if (!this.config.services.hashring) this.config.services.hashring = {};
    if (!this.config.services.cluster) this.config.services.cluster = {};
    if (!this.config.services.http) this.config.services.http = {};
    if (!this.config.services.tcp) this.config.services.tcp = {};
    if (!this.config.services.ws) this.config.services.ws = {};
  }
};
