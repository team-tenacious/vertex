var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

describe(filename, function () {

  var TestCluster = require('../../lib/test-cluster');
  var testCluster = new TestCluster();

  const SERVER_COUNT = 5;

  const CLIENT_COUNT = 5;

  var servers;
  var clients;

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function startClient() {

    return new Promise(function (resolve) {

      var randomServer = servers[getRandomInt(0, SERVER_COUNT - 1)];

      var Client = require('../../..').Client;

      var config = {url: 'ws://localhost:' + randomServer.config.services.http.port};

      var client = new Client(config);

      client.on('connection-confirmed', function () {
        resolve(client);
      });

      client.connect();
    });
  }

  async function startClients() {

    var promises = [];

    for (let i = 0; i < CLIENT_COUNT; i++) {

      promises.push(startClient());
    }

    return await Promise.all(promises);
  }

  function stopClients() {

    if (clients) clients.forEach((client) => {
      client.disconnect();
    })
  }

  before('initializes the cluster with a config', async() => {

    servers = await testCluster.startServers(SERVER_COUNT);
  });

  before('initializes multiple clients', async() => {

    clients = await startClients();
  });

  after('stops clients', () => {

    stopClients();
  });

  after('stops servers', async() => {

    await testCluster.stop();
  });


  it('checks inter-client publish, subscribe and unsubscribe', function (done) {

    this.timeout(15000);

    var randomPathKey = Date.now();

    var wildcardSubscribePath = [randomPathKey, 'wildcard', '*'].join('/');
    var wildcardPublishPath = [randomPathKey, 'wildcard', 'test'].join('/');
    var wildcardPreciseSubscribePath = [randomPathKey, 'precise', '*'].join('/');
    var precisePath = [randomPathKey, 'precise', 'test'].join('/');

    var publisherClient = clients[0];
    var subscriberClient = clients[1];

    var wildcardPreciseSubscribeSubscription;

    var received = {};

    subscriberClient.subscribe(precisePath, function (data) {

      if (!received[precisePath]) received[precisePath] = [];
      received[precisePath].push(data);

    }).then(function () {

      return subscriberClient.subscribe(wildcardSubscribePath, function (data) {

        if (!received[wildcardSubscribePath]) received[wildcardSubscribePath] = [];
        received[wildcardSubscribePath].push(data);
      });
    }).then(function () {

      return subscriberClient.subscribe(wildcardPreciseSubscribePath, function (data) {

        if (!received[wildcardPreciseSubscribePath]) received[wildcardPreciseSubscribePath] = [];
        received[wildcardPreciseSubscribePath].push(data);
      });
    }).then(function (subscription) {

      wildcardPreciseSubscribeSubscription = subscription;

      return publisherClient.publish(precisePath, {test: 'precise'});
    }).then(function () {

      return publisherClient.publish(wildcardPublishPath, {test: 'wildcard'});
    }).then(function () {

      return new Promise(function (resolve) {

        setTimeout(function () {

          expect(received[wildcardSubscribePath].length).to.be(1);
          expect(received[wildcardSubscribePath][0].data.test).to.be('wildcard');
          expect(received[wildcardPreciseSubscribePath][0].data.test).to.be('precise');
          expect(received[wildcardPreciseSubscribePath].length).to.be(1);
          expect(received[precisePath][0].data.test).to.be('precise');
          expect(received[precisePath].length).to.be(1);

          resolve();

        }, 3000);
      });
    }).then(function () {

      return subscriberClient.unsubscribe(wildcardPreciseSubscribeSubscription);
    }).then(function () {

      return publisherClient.publish(precisePath, {test: 'precise-again'});
    }).then(function () {

      setTimeout(function () {

        expect(received[wildcardSubscribePath].length).to.be(1);
        expect(received[wildcardSubscribePath][0].data.test).to.be('wildcard');
        expect(received[wildcardPreciseSubscribePath][0].data.test).to.be('precise');
        expect(received[wildcardPreciseSubscribePath].length).to.be(1);
        expect(received[precisePath].length).to.be(2);
        expect(received[precisePath][1].data.test).to.be('precise-again');

        done();

      }, 3000);
    });
  });

  it('subscribes all the clients to a wildcard path, then does emits with random clients on a precise path that matches the wildcard pattern, ensures all the clients have the messages in the end', function (done) {

    this.timeout(15000);

    var randomPathKey = Date.now();

    var wildcardPath = ['wildcard-all-clients', randomPathKey, '*', '*'].join('/');

    var promises = [];

    var publishPromises = [];

    var received = {};

    var subscriptions;

    var publications;

    var publishedPaths = [];

    for (var i = 0; i < CLIENT_COUNT; i++) {

      promises.push(clients[i].subscribe(wildcardPath, function(data) {

        if (!received[this.connectionInfo.client.sessionId]) received[this.connectionInfo.client.sessionId] = {};

        received[this.connectionInfo.client.sessionId][data.topic] = data;

      }.bind(clients[i])));
    }

    Promise.all(promises)
      .then(function (subs) {

        subscriptions = subs;

        for (var i = 0; i < CLIENT_COUNT; i++) {

          var publishPath = ['wildcard-all-clients', randomPathKey, clients[i].connectionInfo.client.sessionId.replace(/\//g, ''), Date.now()].join('/');

          publishedPaths.push(publishPath);

          publishPromises.push(clients[i].publish(publishPath, {test:clients[i].connectionInfo.client.sessionId.replace(/\//g, '')}));
        }

        Promise.all(publishPromises)
          .then(function (pubs) {

            publications = pubs;

            setTimeout(function () {

              var notFound = 0;

              for (let i = 0; i < CLIENT_COUNT; i++) {

                var client = clients[i];

                var clientReceived = received[client.connectionInfo.client.sessionId];

                if (!clientReceived) {
                  console.log('not found:::', client.connectionInfo.client.sessionId);
                  notFound++;
                  continue;
                }

                publishedPaths.forEach(function(publishedPath){

                  expect(clientReceived[publishedPath]).to.not.be(null);
                });
              }

              if (notFound) return done(new Error('Couldnt find expected publication'));

              done();

            }, 3000);

          }).catch(done);

      }).catch(done);
  });
});
