const expect = require('expect.js');
const TestCluster = require('../../lib/test-cluster');
const { pause } = require('../../../lib/common/utils');

describe('integration - server - cluster', function () {

  before('start servers', async function () {
    this.timeout(10 * 1000);
    this.testCluster = new TestCluster();
    this.servers = await this.testCluster.startServers(5);
  });

  after('stop servers', async function () {
    await this.testCluster.stop();
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

    [server] = await this.testCluster.startServers(1);
    await this.testCluster.stopServer(server);
    await pause(100);

    expect(joinAddress).to.eql('127.0.0.1:60611');
    expect(leaveAddress).to.eql('127.0.0.1:60611');

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

  context('request()', function () {

    it('can write to remote node and receive reply');

    it('rejects after a timeout');

    it('rejects if the remote node goes down after send');

  });

});
