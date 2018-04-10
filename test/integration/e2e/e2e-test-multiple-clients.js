var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

describe(filename, function () {

  var TestCluster = require('../../lib/test-cluster');
  var testCluster = new TestCluster();

  const SERVER_COUNT = 10;

  const CLIENT_COUNT = 1000;

  var servers;
  var clients;

  this.timeout(15000);

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

    console.log('starting servers:::');
    servers = await testCluster.startServers(SERVER_COUNT);
    console.log('started servers:::');
  });

  before('initializes multiple clients', async() => {

    console.log('starting clients:::');
    clients = await startClients();
    console.log('clients started:::');
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

    this.timeout(CLIENT_COUNT * 500 + 10000);

    var randomPathKey = Date.now();

    var wildcardPath = ['wildcard-all-clients', randomPathKey, '*', '*'].join('/');

    var promises = [];

    var publishPromises = [];

    var received = {};

    var subscriptions;

    var publications;

    var publishedPaths = [];

    var messageCount = 0;

    var startedEmitting;

    var endedEmitting;

    var last1000MessagesTimestampPrevious = Date.now();

    for (var i = 0; i < CLIENT_COUNT; i++) {

      promises.push(clients[i].subscribe(wildcardPath, function(data) {

        messageCount++;

        if (messageCount % 10000 == 0) {
          var last1000MessagesTimestampNow = Date.now();
          console.log('messages per ms:::', 10000 / (last1000MessagesTimestampNow - last1000MessagesTimestampPrevious));

          last1000MessagesTimestampPrevious = last1000MessagesTimestampNow;

          console.log('message count:::', messageCount);
        }

        if (!received[this.connectionInfo.client.sessionId]) received[this.connectionInfo.client.sessionId] = {};

        received[this.connectionInfo.client.sessionId][data.topic] = data;

        if (messageCount == CLIENT_COUNT * CLIENT_COUNT) {
          endedEmitting = Date.now();
          console.log('completed ' + CLIENT_COUNT * CLIENT_COUNT + ' messages in: ' + (endedEmitting - startedEmitting) / 1000 + ' seconds');
        }

      }.bind(clients[i])));
    }

    Promise.all(promises)
      .then(function (subs) {

        subscriptions = subs;

        startedEmitting = Date.now();

        for (var i = 0; i < CLIENT_COUNT; i++) {

          var publishPath = ['wildcard-all-clients', randomPathKey, clients[i].connectionInfo.client.sessionId.replace(/\//g, ''), Date.now()].join('/');

          publishedPaths.push(publishPath);

          publishPromises.push(clients[i].publish(publishPath, {test:clients[i].connectionInfo.client.sessionId.replace(/\//g, '')}));
        }

        Promise.all(publishPromises)
          .then(function (pubs) {

            publications = pubs;

            console.log('tallying up:::');

            setTimeout(function () {

              var notFound = 0;

              var notReceived = 0;

              for (let i = 0; i < CLIENT_COUNT; i++) {

                var client = clients[i];

                var clientReceived = received[client.connectionInfo.client.sessionId];

                if (!clientReceived) {
                  console.log('not found:::', client.connectionInfo.client.sessionId);
                  notFound++;
                  continue;
                }

                publishedPaths.forEach(function(publishedPath){
                  if (clientReceived[publishedPath] == null) notReceived++;
                });
              }

              if (notFound) return done(new Error('Couldnt find expected publication'));
              if (notReceived) return done(new Error('Couldnt find expected received publication'));

              done();

            }, 3000);

          }).catch(done);

      }).catch(done);
  });

  it('subscribes all the clients to a precise path, then does emits with random clients on each precise path, ensures all the clients have their messages in the end', function (done) {

    this.timeout(CLIENT_COUNT * 500 + 10000);

    var promises = [];

    var publishPromises = [];

    var received = {};

    var subscriptions;

    var publications;

    var publishedPaths = [];

    var messageCount = 0;

    var startedEmitting;

    var endedEmitting;

    var last1000MessagesTimestampPrevious = Date.now();

    for (var i = 0; i < CLIENT_COUNT; i++) {

      var precisePath = ['precise-all-clients', clients[i].connectionInfo.client.sessionId].join('/');

      promises.push(clients[i].subscribe(precisePath, function(data) {

        messageCount++;

        if (messageCount % 100 == 0) {
          var last1000MessagesTimestampNow = Date.now();
          console.log('messages per ms:::', 100 / (last1000MessagesTimestampNow - last1000MessagesTimestampPrevious));

          last1000MessagesTimestampPrevious = last1000MessagesTimestampNow;

          console.log('message count:::', messageCount);
        }

        if (!received[this.connectionInfo.client.sessionId]) received[this.connectionInfo.client.sessionId] = [];

        received[this.connectionInfo.client.sessionId].push([data]);

        if (messageCount == CLIENT_COUNT) {
          endedEmitting = Date.now();
          console.log('completed ' + CLIENT_COUNT + ' messages in: ' + (endedEmitting - startedEmitting) / 1000 + ' seconds');
        }

      }.bind(clients[i])));
    }

    Promise.all(promises)
      .then(function (subs) {

        subscriptions = subs;

        startedEmitting = Date.now();

        for (var i = 0; i < CLIENT_COUNT; i++) {

          var publishPath = ['precise-all-clients', clients[i].connectionInfo.client.sessionId].join('/');

          publishedPaths.push(publishPath);

          var randomClientIndex = Math.floor(Math.random()*CLIENT_COUNT);

          publishPromises.push(clients[randomClientIndex].publish(publishPath, {test:clients[i].connectionInfo.client.sessionId.replace(/\//g, '')}));
        }

        Promise.all(publishPromises)
          .then(function (pubs) {

            publications = pubs;

            console.log('tallying up:::');

            setTimeout(function () {

              var notFound = 0;

              var notReceived = 0;

              for (let i = 0; i < CLIENT_COUNT; i++) {

                var client = clients[i];

                var clientReceived = received[client.connectionInfo.client.sessionId];

                if (!clientReceived) {
                  console.log('not found:::', client.connectionInfo.client.sessionId);
                  notFound++;
                  continue;
                }

                // publishedPaths.forEach(function(publishedPath){
                //   if (clientReceived[publishedPath] == null) notReceived++;
                // });
              }

              if (notFound) return done(new Error('Couldnt find expected publication'));
              if (notReceived) return done(new Error('Couldnt find expected received publication'));

              done();

            }, 3000);

          }).catch(done);

      }).catch(done);
  });
});
