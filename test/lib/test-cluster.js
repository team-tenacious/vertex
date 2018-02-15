const { Server } = require('../../');

module.exports = class TestCluster {

  constructor() {
    this.seq = 0;
    this.servers = [];
  }

  async startServers(count, opts = {}) {
    var servers;
    var promises = [];

    for (var i = 0; i < count; i++) {
      promises.push(Server.create(this.createConfig(this.seq++, opts)));
    }

    servers = await Promise.all(promises);

    this.servers = this.servers.concat(servers);
    return servers;
  }

  async stop() {
    for (var i = 0; i < this.servers.length; i++) {
      await this.servers[i].stop();
    }
  }

  async stopServer(server) {
    var offset = this.servers.indexOf(server);
    if (offset >= 0) this.servers.splice(offset, 1);
    await server.stop();
  }

  createConfig(seq, opts) {
    var config = {
      name: 'node_' + seq,
      logger: {
        level: process.env.LOG_LEVEL || 'info'
      },
      services: {
        tcp: {
          host: '127.0.0.1',
          port: 60606 + seq
        },
        cluster: {
          secret: 'xxx',
          seed: seq == 0,
          join: ['127.0.0.1:60606', '127.0.0.1:60607', '127.0.0.1:60608'],
          joinWait: 200
        },
        http: {
          port: 3737 + seq
        }
      }
    }

    if (typeof opts.clusterRequestTimeout == 'number') {
      config.services.cluster.requestTimeout = opts.clusterRequestTimeout;
    }

    console.log(config);

    return config;
  }
}
