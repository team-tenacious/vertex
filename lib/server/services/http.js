const {ServerError} = require('../errors');
const express = require('express');
const http = require('http');

module.exports = class Http {

  static get dependants() { return ['ws']; }

  constructor(server, logger, config) {

    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
    this.app = express();

    this.app.get('/ping', function(req, res){
      res.send('pong');
    });

    this.httpServer = http.createServer(this.app);
  }

  async start() {
    this.logger.info('starting');

    await this.startHttpService();
  }

  async stop() {
    this.logger.info('stopping');

    await this.stopHttpService();
  }

  async startHttpService() {

    return this.httpServer.listen(this.config.port);
  }

  async stopHttpService() {

    if (this.httpServer) return this.httpServer.close();
  }

  defaults() {
    this.config.port = this.config.port || 3737;
  }

  validate() {

  }
}
