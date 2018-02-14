module.exports = class Sockets {

  static get dependants() { return ['cluster', 'tcp']; }

  constructor(server, logger, config) {
    this.logger = logger;
    this.sockets = [];
  }

  async start() {}

  async stop() {
    this.logger.info('stopping');
    this.sockets.forEach(socket => {
      socket.end();
    });
    this.sockets.length = 0;
  }

  add(socket) {
    this.sockets.push(socket);
  }

  remove(socket) {
    var offset = this.sockets.indexOf(socket);
    if (offset < 0) return;
    this.sockets.splice(offset, 1);
  }

}
