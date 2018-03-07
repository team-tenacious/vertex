var path = require('path');
var filename = path.basename(__filename);
var Subscription = require('../../../lib/server/services/subscription');
const SubscriptionCache = require('../../../lib/server/services/subscription-cache');
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;

describe(filename, function () {

  async function mockServer() {

    var ws = new EventEmitter();
    var hashring = new EventEmitter();
    var cluster = new EventEmitter();

    ws.write = (sessionId, message) => {
      ws.emit('wrote', {sessionId: sessionId, message: message});
    };

    cluster.listPeers = function () {
      return ['10:0.0.1:5000', '10:0.0.2:5000', '10:0.0.3:5000', '10:0.0.4:5000'];
    };

    cluster.request = function (peer, message) {
      return new Promise(function (resolve) {

        if (message.action == 'subscription-query') return resolve({subscriptions: ['10:0.0.1:5000', '10:0.0.2:5000']});

        resolve('ok');
      })
    };

    cluster.advertiseAddress = '10.0.0.1:8000';

    cluster.write = function (address, message) {
      return new Promise(function (resolve) {
        resolve();
      });
    };

    hashring.listMembers = function (topic) {
      return ['10:0.0.1:5000'];
    };

    var cache = new SubscriptionCache({}, mockLogger(), mockConfig());

    await cache.start();

    return {
      tearDown:function(){
        this.services['subscription-cache'].stop();
      },
      services: {
        cluster: cluster,
        ws: ws,
        hashring: hashring,
        'subscription-cache': cache
      }
    }
  }

  function mockLogger() {

    return {
      info: function () {

      },
      error: function () {

      }
    }
  }

  function mockConfig() {

    return {};
  }

  it('starts the subscription service, pushes a subscribe action through', function (done) {

    mockServer().then(function (server) {

      var subscription = new Subscription(server, mockLogger(), mockConfig());

      subscription.on('message-process-ok', function (data) {
        expect(data.response == 0 || data.response == 1).to.be(true);
        server.tearDown();
        done();
      });

      server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
    });
  });

  it('starts the subscription service, pushes an unsubscribe action through', function (done) {

    mockServer().then(function (server) {

      var subscription = new Subscription(server, mockLogger(), mockConfig());

      subscription.on('message-process-ok', function (data) {

        if (data.message.action == 'subscribe') {
          expect(data.response == 0 || data.response == 1).to.be(true);
          server.services.cluster.emit('message', '10.0.0.1:6767', {
            action: 'unsubscribe',
            payload: {topic: 'test-topic'}
          });
        }
        else {
          expect(data.message.action).to.be('unsubscribe');
          expect(data.response == 0 || data.response == 1).to.be(true);
          server.tearDown();
          done();
        }
      });

      server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
    });
  });

  it('starts the subscription service, pushes a edges action through', function (done) {

    mockServer().then(function (server) {

      var subscription = new Subscription(server, mockLogger(), mockConfig());

      subscription.on('message-process-ok', function (data) {

        if (data.message.action == 'subscribe') {

          expect(data.response == 0 || data.response == 1).to.be(true);

          server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'edges', payload: {topic: 'test-topic'}});
        }
        else {

          expect(data.message.action).to.be('edges');
          expect(data.response).to.eql(['10.0.0.1:6767']);

          server.tearDown();
          done();
        }
      });

      server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
    });
  });
});
