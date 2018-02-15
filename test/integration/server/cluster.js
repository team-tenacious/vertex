const expect = require('expect.js');
const TestCluster = require('../../lib/test-cluster');
const Protocol = require('../../../lib/common/protocol');
const protocol = new Protocol();
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

  context.only('request()', function () {

    it('can write to remote node and receive reply', async function () {

      var sender = this.servers[1];
      var receiver = this.servers[0];
      var receiverAddress = receiver.services.cluster.advertiseAddress;

      receiver.services.cluster.on('message', (senderAddress, message) => {
        var reply = protocol.createReply(message, {replyPayload: 1});
        receiver.services.cluster.write(senderAddress, reply)
          .catch(console.error);
      });

      var reply = await sender.services.cluster.request(receiverAddress, {});
      expect(reply.payload).to.eql({replyPayload: 1});

    });

    it('rejects after a timeout', async function () {

      var sender = this.servers[2];
      var [receiver] = await this.testCluster.startServers(1, {
        clusterRequestTimeout: 200
      });
      var receiverAddress = receiver.services.cluster.advertiseAddress;

      try {
        console.log('SEND');
        await sender.services.cluster.request(receiverAddress, {});
        console.log('SENT');
      } catch (e) {
        console.log('GOT ERROR', e);
      }

      await this.testCluster.stopServer(receiver);
      await pause(100);

    });

    it('rejects if the remote node goes down after send');

  });

});
