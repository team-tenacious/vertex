const net = require('net');
const os = require('os');
const JsonSocket = require('json-socket');
const Protocol = require('../../common/protocol');


const WAIT_FOR_LOGIN = 10 * 1000;

module.exports = class Tcp {

  constructor(server, logger, config) {
    this.services = server.services;
    this.logger = logger;
    this.config = config;

    this.protocol = new Protocol();

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

  async stop() {
    this.logger.info('stopping');
    this.server.close();
  }

  onListening() {
    var address = this.server.address();

    this.advertiseAddress = this.getAddvertiseAddress(address);
    this.logger.info('listening %s:%s', address.address, address.port);
    this.logger.info('advertising', this.advertiseAddress);

    this.server.removeAllListeners('error');
    this.server.on('error', this.onServerError.bind(this));
    this.server.on('connection', this.onConnection.bind(this));

    this.server.on('connection', socket => {

    });
  }

  onServerError(err) {
    // TODO: what to do?
    this.logger.error('server error', err);
  }

  onConnection(socket) {
    var timeout, jsonSocket;
    var { remoteAddress, remotePort } = socket;

    this.logger.debug('connection from %s:%s', remoteAddress, remotePort);

    this.services.sockets.add(socket);

    socket.on('error', err => {
      this.logger.error('socket error on %s:%s', remoteAddress, remotePort, err);
    })

    socket.on('close', () => {
      this.logger.debug('disconnection from %s:%s', remoteAddress, remotePort);
      this.services.sockets.remove(socket);
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

        if (!message.payload) {
          this.logger.error('Missing join payload from %s:%s', remoteAddress, remotePort);
          return socket.end();
        }

        if (!message.payload.key) {
          this.logger.error('Missing join key from %s:%s', remoteAddress, remotePort);
          return socket.end();
        }

        if (message.payload.key != this.config.key) {
          this.logger.error('Wrong join key from %s:%s', remoteAddress, remotePort);
          return socket.end();
        }

        if (!message.payload.address) {
          this.logger.error('Missing join address from %s:%s', remoteAddress, remotePort);
          return socket.end();
        }

        var peer = this.services.cluster.addPeer({
          address: message.payload.address,
          socket: socket,
          jsonSocket: jsonSocket
        });

        var peers = this.services.cluster.listPeers();

        var action = 'join-ack';
        var options = {};
        var payload = {
          peers: peers
        };
        // TODO: implement working reply: this has new tx id and probably shouldn't
        var reply = this.protocol.createMessage(action, payload, options);

        peer.write(reply).catch(err => {
          this.logger.error('write error', err);
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
    if (!this.config.key) {
      this.logger.warn('using default tcp connection key');
      this.config.key = 'secret';
    }

    this.config.host = this.config.host || '0.0.0.0';
    this.config.port = typeof this.config.port == 'number' ? parseInt(this.config.port) : 60606;
  }

  validate() {

  }

}
