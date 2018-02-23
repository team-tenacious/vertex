var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

describe(filename, function () {

  var TestCluster = require('../../lib/test-cluster');
  var testCluster = new TestCluster();

  before('initializes the cluster with a config', async () => {

    await testCluster.startServers(2);
  });

  after('stops servers', async () => {

    await testCluster.stop();
  });


  it('connects with a client and disconnects', function (done) {

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    client.on('connected', function () {

      client.on('close', function (info) {
        expect(info.code).to.be(1);
        expect(info.reason).to.be('intentional disconnect test');
        done();
      });

      client.disconnect({code: 1, reason: 'intentional disconnect test'});
    });

    client.connect();
  });

  it('does the client subscribe', function (done) {

    this.timeout(10000);

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    var emitCount = 0;

    client.on('connected', function () {

      client.subscribe('/a/test/path', function (data) {
        emitCount++;
      }).then(function (subKey) {
        console.log('subKey:::',subKey);
        done();
      }).catch(done);
    });

    client.connect();
  });

  it('does the client subscribe and publish', function (done) {

    this.timeout(10000);

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    client.on('connected', function () {

      client.subscribe('/a/test/path', function (data) {
        done();
      }).then(function (subKey) {

        client.publish('/a/test/path', {some: "data"})
          .then((response) => {
            console.log('published on:::', response);
          }).catch(done);

      }).catch(done);
    });

    client.connect();
  });

  it('does the client subscribe, publish and unsubscribe', function (done) {

    this.timeout(10000);

    var Client = require('../../..').Client;

    var config = {url: 'ws://localhost:3737'};

    var client = new Client(config);

    var emitCount = 0;

    client.on('connected', function () {

      client.on('close', function (info) {
        done();
      });

      client.subscribe('/a/test/path', function (data) {
        emitCount++;
      }).then(function (subKey) {

        console.log('subscribed on:::', subKey);

        client.publish('/a/test/path', {some: "data"})
          .then((response) => {

            console.log('published on:::', response);

            client.unsubscribe(subKey).then(function (response) {

              console.log('unsubscribed on:::', response);

              client.publish('/a/test/path', {some: "data"})
                .then(function (response) {

                  console.log('published again on:::', response);

                  setTimeout(() => {
                    if (emitCount > 1) return done(new Error('unsub failed'));
                    else client.disconnect({code: 1, reason: 'intentional disconnect test'});
                  }, 5000);

                }).catch(done);
            });

          }).catch(done);

      }).catch(done);
    });

    client.connect();
  });
});
