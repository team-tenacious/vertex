var path = require('path');
var filename = path.basename(__filename);
var Subscription = require('../../../lib/server/services/subscription');
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;

xdescribe(filename, function () {


  function mockServer() {

    var ws = new EventEmitter();
    var hashring = new EventEmitter();
    var cluster = new EventEmitter();
    var cache = new EventEmitter();

    var __cache = {};

    ws.write = (sessionId, message) => {
      ws.emit('wrote', {sessionId: sessionId, message: message});
    };

    cache.get = function (key) {
      return new Promise(function (resolve) {
        resolve(__cache[key] || []);
      });
    };

    cache.set = function (key, value) {
      return new Promise(function (resolve) {
        __cache[key] = value;
        resolve(value);
      });
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

    cluster.write = function(address, message){
      return new Promise(function (resolve) {
        resolve();
      });
    };

    hashring.listMembers = function (topic) {
      return ['10:0.0.1:5000'];
    };

    return {
      services: {
        cluster: cluster,
        ws: ws,
        hashring: hashring,
        cache: cache
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

  it('starts the subscription service, pushes an unknown action through', function (done) {

    var server = mockServer();

    var subscription = new Subscription(server, mockLogger(), mockConfig());

    subscription.on('message-process-error', function (e) {
      expect(e.toString()).to.be('Error: No handler for action: unknown');
      done();
    });

    server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'unknown'});
  });

  it('starts the subscription service, pushes a subscribe action through', function (done) {

    var server = mockServer();

    var subscription = new Subscription(server, mockLogger(), mockConfig());

    subscription.on('message-process-ok', function (data) {
      expect(data.response).to.eql([ '10.0.0.1:6767' ]);
      done();
    });

    server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
  });

  it('starts the subscription service, pushes an unsubscribe action through', function (done) {

    var server = mockServer();

    var subscription = new Subscription(server, mockLogger(), mockConfig());

    subscription.on('message-process-ok', function (data) {

      if (data.message.action == 'subscribe'){
        expect(data.response).to.eql([ '10.0.0.1:6767' ]);
        server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'unsubscribe', payload: {topic: 'test-topic'}});
      }
      else {
        expect(data.message.action).to.be('unsubscribe');
        expect(data.response).to.eql([]);
        done();
      }
    });

    server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
  });

  it('starts the subscription service, pushes a edges action through', function (done) {

    var server = mockServer();

    var subscription = new Subscription(server, mockLogger(), mockConfig());

    subscription.on('message-process-ok', function (data) {

      if (data.message.action == 'subscribe') {

        expect(data.response).to.eql([ '10.0.0.1:6767' ]);

        server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'edges', payload: {topic: 'test-topic'}});
      }
      else {

        expect(data.message.action).to.be('edges');
        expect(data.response).to.eql([ '10.0.0.1:6767' ]);
        done();
      }
    });

    server.services.cluster.emit('message', '10.0.0.1:6767', {action: 'subscribe', payload: {topic: 'test-topic'}});
  });
});
