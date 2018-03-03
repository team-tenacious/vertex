var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

describe(filename, function () {

  const Redis = require('ioredis');
  var redis;

  var TestCluster = require('../../lib/test-cluster');
  var testCluster = new TestCluster();

  var timestamp = Date.now();

  var clusterServers;

  before('initializes the cluster with a config, creates a redis client', (done) => {

    testCluster.startServers(2)
      .then(function (servers) {

        clusterServers = servers;

        redis = new Redis();

        redis.on('error', done);

        redis.on('connect', () => {
          done();
        });
      })
      .catch(done);
  });

  after('stops servers', async() => {

    await testCluster.stop();
  });

  function checkForSubscriptionData(path, connectionInfo) {

    return new Promise(function (resolve, reject) {

      redis.smembers('EDGE_SUBSCRIPTION_TOPICS:' + connectionInfo.server.address)
        .then(function (members) {

          if (members[0] != path) return reject(new Error('could not find topic: ' + path));

          return redis.smembers(path);

        })
        .then(function (pathMembers) {

          if (pathMembers[0] != connectionInfo.server.address) return reject(new Error('could not find edge subscription to: ' + path));

          resolve();
        })
        .catch(reject);
    });
  }

  function checkForSubscriptionDataRemoved(path, connectionInfo) {

    return new Promise(function (resolve, reject) {

      redis.smembers('EDGE_SUBSCRIPTION_TOPICS:' + connectionInfo.server.address)
        .then(function (members) {

          if (members.length > 0) return reject(new Error('edge subscriptions trunk should be empty'));

          return redis.smembers(path);
        })
        .then(function (pathMembers) {

          if (pathMembers.length > 0) return reject(new Error('cluster subscriptions should be empty'));

          resolve();
        })
        .catch(reject);
    });
  }

  it('does the client subscribe and unsubscribe, checks redis to ensure we have the correct data entries and that they get deleted', function (done) {

    this.timeout(10000);

    var testPath = '/a/test/subscribe/path' + timestamp;

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    var subscriptionKey;

    client.on('connection-confirmed', function (connectionInfo) {

      client.subscribe(testPath, function (data) {
          //do nothing
        })
        .then(function (subKey) {

          subscriptionKey = subKey;

          return checkForSubscriptionData(testPath, connectionInfo);
        })
        .then(() => {

          return client.unsubscribe(subscriptionKey);
        })
        .then(() => {

          return checkForSubscriptionDataRemoved(testPath, connectionInfo);
        })
        .then(done).catch(done);
    });

    client.connect();
  });
});
