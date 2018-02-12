const net = require('net');
const os = require('os');
const JsonSocket = require('json-socket');

module.exports = class Tcp {

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;

    this.config.host = this.config.host || '0.0.0.0';
    this.config.port = typeof this.config.port == 'number' ? parseInt(this.config.port) : 60606;

  }

  start() {
    return new Promise((resolve, reject) => {
      this.logger.info('starting');

      this.server = net.createServer();

      this.server.on('error', reject);

      this.server.once('listening', () => {
        var address = this.server.address();

        this.advertise = this.getAddvertiseAddress(address);
        this.logger.info('listening %s:%s', address.address, address.port);
        this.logger.info('advertising', this.advertise);

        // stop the (startup) reject error listener
        this.server.removeAllListeners('error');

        // create permanent error listener
        this.server.on('error', err => {
          // only log the error, nothing else really to do
          this.logger.error('server error', err);
        });

        resolve();
      });

      this.server.listen(this.config.port, this.config.host);
    });
  }

  async stop() {
    this.logger.info('stopping');
    this.server.close();
    this.logger.info('>>>>>TODO: close all sockets')
  }

  getAddvertiseAddress(address) {
    if (address.address == '::' || address.address == '0.0.0.0') {
      // return first external Ipv4 address
      var interfaces = os.networkInterfaces();
      for (var iface in interfaces) {
        iface = interfaces[iface];
        for (var addr of iface) {
          if (addr.family != 'IPv4') continue;
          if (addr.internal) continue;
          return addr.address + ':' + address.port;
        }
      }
    }

    return address.address + ':' + address.port;
  }

}
