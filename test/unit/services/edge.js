var path = require('path');
var filename = path.basename(__filename);
var Edge = require('../../../lib/server/services/edge');
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;
const SubscriptionCache = require('../../../lib/server/services/subscription-cache');
const protocol = require('../../../lib/common/protocol').create();

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

        if (message.action == 'edges') return resolve(protocol.createReply(message, {response:  ['10:0.0.1:5000', '10:0.0.2:5000'], status:1}));
        resolve('ok');
      })
    };

    cluster.advertiseAddress = '10.0.0.1:8000';

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

  it('starts the edge service, pushes a subscribe action through', function (done) {

    mockServer().then(function (server) {

      var edge = new Edge(server, mockLogger(), mockConfig());

      edge.start().then(()=> {

        edge.on('message-process-ok', function (data) {
          expect(data.response).to.be('ok');
          server.tearDown();
          done();
        });

        server.services.ws.emit('message', {
          sessionId: 'testId',
          data: {action: 'subscribe', payload: {topic: 'test-topic'}}
        });
      })
    });
  });

  it('starts the edge service, pushes an unsubscribe action through', function (done) {

    mockServer()
      .then(function (server) {

        var edge = new Edge(server, mockLogger(), mockConfig());

        edge.on('message-process-ok', function (data) {

          expect(data.response == 'ok' || data.response == 1).to.be(true);

          if (data.message.data.action == 'subscribe') {
            server.services.ws.emit('message', {
              sessionId: 'testId',
              data: {action: 'unsubscribe', payload: {topic: 'test-topic'}}
            });
          }
          else {

            expect(data.message.data.action).to.be('unsubscribe');
            server.tearDown();
            done();
          }
        });

        server.services.ws.emit('message', {
          sessionId: 'testId',
          data: {action: 'subscribe', payload: {topic: 'test-topic'}}
        });

      });
  });

  it('starts the edge service, pushes a publish action through', function (done) {

    mockServer()
      .then(function (server) {

        var edge = new Edge(server, mockLogger(), mockConfig());

        edge.on('message-process-ok', function (data) {

          if (data.message.data.action == 'subscribe') {

            expect(data.response).to.be('ok');

            server.services.ws.emit('message', {
              sessionId: 'testId',
              data: {action: 'publish', payload: {topic: 'test-topic', data: 'test-data'}}
            });
          }
          else {

            expect(data.message.data.action).to.be('publish');
            expect(data.response).to.eql({'test-topic': 2, '*': 2});
            server.tearDown();
            done();
          }
        });

        server.services.ws.emit('message', {
          sessionId: 'testId',
          data: {action: 'subscribe', payload: {topic: 'test-topic'}}
        });
      });
  });
});
