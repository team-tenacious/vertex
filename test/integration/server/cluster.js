const { Server } = require('../../../');

describe('integration - server - membership', function () {

  var seq = 0;

  before('start servers', async function () {

    function createConfig(seq) {
      return {
        name: 'node_' + seq,
        services: {
          tcp: {
            key: 'xxx',
            host: '127.0.0.1',
            port: 60606 + seq
          },
          cluster: {
            seed: seq == 0,
            join: ['127.0.0.1:60606', '127.0.0.1:60607', '127.0.0.1:60608'],
            joinWait: 200
          },
          http: {
            port: 3737 + seq
          }
        }
      }
    }

    this.servers = await Promise.all([
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++))
    ]);

  });

  after('stop servers', async function () {

    for (var i = 0; i < this.servers.length; i++) {
      await this.servers[i].stop();
    }

  });

  it('fully connected the members', function () {

  });

  it('emits on member joined');

  it('emits on member left');

  it('can write to peer in cluster');

  it('can write to self');

});
