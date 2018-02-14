const net = require('net');
const os = require('os');
const JsonSocket = require('json-socket');

const WAIT_FOR_LOGIN = 10 * 1000;

module.exports = class Tcp {

  static get dependants() { return []; }

  constructor(server, logger, config) {
    this.cluster = server.services.cluster;
    this.sockets = server.services.sockets;
    this.logger = logger;
    this.config = config;

    this.defaults();
    this.validate();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.logger.info('starting');

      this.server = net.createServer();

      this.server.on('error', reject);

      this.server.once('listening', () => {
        this.onListening();
        resolve();
      });

      this.server.listen(this.config.port, this.config.host);
    });
  }

  stop() {
    return new Promise(resolve => {
      this.logger.info('stopping');
      this.server.close(resolve);
    });
  }

  onListening() {
    var address = this.server.address();

    this.cluster.advertiseAddress = this.getAddvertiseAddress(address);

    this.logger.info('listening %s:%s', address.address, address.port);
    this.logger.info('advertising', this.advertiseAddress);

    this.server.removeAllListeners('error');
    this.server.on('error', this.onServerError.bind(this));
    this.server.on('connection', this.onConnection.bind(this));
  }

  onServerError(err) {
    // TODO: what to do?
    this.logger.error('server error', err);
  }

  onConnection(socket) {
    var timeout, jsonSocket;
    var { remoteAddress, remotePort } = socket;

    this.logger.debug('connection from %s:%s', remoteAddress, remotePort);

    this.sockets.add(socket);

    socket.on('error', err => {
      this.logger.error('socket error on %s:%s', remoteAddress, remotePort, err);
    })

    socket.once('close', () => {
      this.logger.debug('disconnection from %s:%s', remoteAddress, remotePort);
      clearTimeout(timeout);
    });

    timeout = setTimeout(() => {
      this.logger.debug('missing login from %s:%s', remoteAddress, remotePort);
      socket.end();
    }, WAIT_FOR_LOGIN);

    jsonSocket = new JsonSocket(socket);

    jsonSocket.on('error', err => {
      this.logger.error('json socket error on %s:%s', remoteAddress, remotePort, err);
    });

    jsonSocket.on('message', message => {
      if (message.action == 'join') {
        clearTimeout(timeout);

        this.cluster.handleJoinMessage({
          message: message,
          socket: socket,
          jsonSocket: jsonSocket
        });
      }
    });
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

  defaults() {
    this.config.host = this.config.host || '0.0.0.0';
    this.config.port = typeof this.config.port == 'number' ? parseInt(this.config.port) : 60606;
  }

  validate() {

  }

}
