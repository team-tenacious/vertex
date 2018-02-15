var path = require('path');
var filename = path.basename(__filename);
var Edge = require('../../../lib/server/services/edge');
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;

describe(filename, function () {


  function mockServer() {

    var ws =  new EventEmitter();
    var hashring =  new EventEmitter();
    var cluster =  new EventEmitter();
    var cache =  new EventEmitter();

    var __cache = {};

    ws.write = (sessionId, message) => {
      ws.emit('wrote', {sessionId:sessionId, message:message});
    };

    cache.get = function(key){
      return new Promise(function(resolve){
        resolve(__cache[key] || []);
      });
    };

    cache.set = function(key, value){
      return new Promise(function(resolve){
        __cache[key] = value;
        resolve(value);
      });
    };

    cluster.listPeers = function(){
      return ['10:0.0.1:5000','10:0.0.2:5000','10:0.0.3:5000','10:0.0.4:5000'];
    };

    cluster.request = function(peer, message){
      return new Promise(function(resolve){
        resolve('ok');
      })
    };

    hashring.listMembers = function(topic){
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

  it('starts the edge service, pushes an unknown action through', function (done) {

    var server = mockServer();

    var edge = new Edge(server, mockLogger(), mockConfig());

    edge.on('message-process-error', function(e){
      expect(e.toString()).to.be('Error: No handler for action: unknown');
      done();
    });

    server.services.ws.emit('message', {sessionId:'testId', data:{action:'unknown'}});
  });

  it('starts the edge service, pushes a subscribe action through', function (done) {

    var server = mockServer();

    var edge = new Edge(server, mockLogger(), mockConfig());

    edge.on('message-process-ok', function(data){
      expect(data.response).to.be('ok');
      done();
    });

    server.services.ws.emit('message', {sessionId:'testId', data:{action:'subscribe', payload:{topic:'test-topic'}}});
  });

  it('starts the edge service, pushes an unsubscribe action through', function (done) {

    var server = mockServer();

    var edge = new Edge(server, mockLogger(), mockConfig());

    edge.on('message-process-ok', function(data){
      expect(data.response).to.be('ok');
      if (data.message.data.action == 'subscribe')
        server.services.ws.emit('message', {sessionId:'testId', data:{action:'unsubscribe', payload:{topic:'test-topic'}}});
      else {
        expect(data.message.data.action).to.be('unsubscribe');
        done();
      }
    });

    server.services.ws.emit('message', {sessionId:'testId', data:{action:'subscribe', payload:{topic:'test-topic'}}});
  });
});
