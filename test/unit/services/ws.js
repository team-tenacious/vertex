var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Http = require('../../../lib/server/services/http');
var Ws = require('../../../lib/server/services/ws');

describe(filename, function () {

  var mockServer;
  var mockLogger;
  var mockConfig = {};

  before('itinitializes the http service and mocks', function(done){

    mockLogger = {
      info:function(){},
      error:function(){}
    };

    mockServer = {
      services:{}
    };

    var http = new Http(mockServer, mockLogger, {});

    http.start()
      .then(function () {
        mockServer.services['http'] = http;
        done();
      })
      .catch(done);
  });

  it('starts and stops the ws service', function (done) {

    var ws = new Ws(mockServer, mockLogger, mockConfig);

    ws.start()
      .then(function () {
        return ws.stop();
      })
      .then(function(){
        done();
      })
      .catch(done);
  });

  it('pings the ws service', function (done) {

    var ws = new Ws(mockServer, mockLogger, mockConfig);

    ws.start()
      .then(function () {
        var request = require('request');
        request('http://localhost:3737/ping', function (error, response, body) {
          expect(error).to.be(null);
          expect(body).to.be('pong');
          done();
        })
      }).catch(done);
  });
});
