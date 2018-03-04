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

  function checkForClusterSubscriptionData(path, connectionInfo) {

    return new Promise(function (resolve, reject) {

      redis.smembers(path)
        .then(function (pathMembers) {

          if (pathMembers[0] != connectionInfo.server.address) return reject(new Error('could not find cluster subscription to: ' + path));

          resolve();
        })
        .catch(reject);
    });
  }

  function checkForNoClusterSubscriptionData(path, connectionInfo) {

    return new Promise(function (resolve, reject) {

      redis.smembers(path)
        .then(function (pathMembers) {

          if (pathMembers.length > 0) return reject(new Error('cluster subscription should be empty: ' + path));

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


  it('does the client subscribe, then removes edge subscription via external means, does a publish and checks the back pressure unsubscribe has happened', function (done) {

    this.timeout(10000);

    var testPath = '/a/test/subscribe/path/2' + timestamp;

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    var subscriptionKey;

    client.on('connection-confirmed', function (connectionInfo) {

      client.subscribe(testPath, function (data) {

        })
        .then(function (subKey) {

          subscriptionKey = subKey;

          return checkForClusterSubscriptionData(testPath, connectionInfo);
        })
        .then(() => {

          //externally remove the edge subscription, this should cause back-pressure on the publish event to clean out the cluster subscription
          return redis.srem('EDGE_SUBSCRIPTION_SESSIONS:' + connectionInfo.server.address + ':' + testPath, connectionInfo.client.sessionId);
        })
        .then(() => {

          return client.publish(testPath, {test:'data'});
        })
        .then(() => {

          return new Promise((resolve, reject) => {

            // wait a bit to ensure back-pressure request happened TODO: think about a possible race condition if back pressure happens after a legitimate subscribe happens
            // perhaps all subscription activities must be queued with concurrency 1 on the edge ?
            setTimeout(function(){

              checkForNoClusterSubscriptionData(testPath, connectionInfo).then(resolve).catch(reject);

            }, 3000);
          });
        })
        .then(done).catch(done);
    });

    client.connect();
  });
});
