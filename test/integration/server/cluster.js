const expect = require('expect.js');
const { Server } = require('../../../');
const { pause } = require('../../../lib/common/utils');

describe('integration - server - cluster', function () {

  var seq = 0;

  function createConfig(seq) {
    return {
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
  }

  before('start servers', async function () {

    this.timeout(10 * 1000);

    this.servers = await Promise.all([
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++))
    ]);

  });

  after('stop servers', async function () {
    if (!this.servers) return;
    for (var i = 0; i < this.servers.length; i++) {
      await this.servers[i].stop();
    }

  });

  it('fully connected the members', function () {

    for (var server of this.servers) {
      var peerList = server.services.cluster.listPeers();
      expect(peerList).to.eql([
        '127.0.0.1:60606',
        '127.0.0.1:60607',
        '127.0.0.1:60608',
        '127.0.0.1:60609',
        '127.0.0.1:60610'
      ]);
    }

  });

  it('emits on member join and leave', async function () {

    this.timeout(5 * 1000);

    var joinAddress;
    var leaveAddress;
    var server;

    this.servers[4].services.cluster.on('join', address => joinAddress = address);
    this.servers[4].services.cluster.on('leave', address => leaveAddress = address);

    server = await Server.create(createConfig(100));
    await server.stop();
    await pause(100);

    expect(joinAddress).to.eql('127.0.0.1:60706');
    expect(leaveAddress).to.eql('127.0.0.1:60706');

  });

  it('can write to all peers to all peers in the cluster', async function () {

    this.timeout(5 * 1000);

    for (var server of this.servers) {
      var messages = {};
      var address = server.services.cluster.advertiseAddress;

      server.services.cluster.on('message', (source, message) => {
        messages[source] = message.data;
      });

      for (var server of this.servers) {
        // console.log('send', server.services.cluster.advertiseAddress, '=>', address);
        await server.services.cluster.write(address, { data: 1 });
      }

      await pause(100);

      expect(messages).to.eql({
        '127.0.0.1:60606': 1,
        '127.0.0.1:60607': 1,
        '127.0.0.1:60608': 1,
        '127.0.0.1:60609': 1,
        '127.0.0.1:60610': 1
      });

    }

  });

});
