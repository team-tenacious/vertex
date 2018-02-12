var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

describe(filename, function () {

  it('initializes a client with a config', function (done) {

    var Client = require('../../..').Client;

    var config = {url:'ws://127.0.0.1:3737'};

    var client = new Client(config);

    expect(client.config).to.eql({
      connectionAttemptInterval:5000,
      connectionOptions:{},
      url:'ws://127.0.0.1:3737'
    });

    done();
  });

  it('mocks the connection uses it to test the client connect', function (done) {

    var Client = require('../../..').Client;

    var config = {url:'ws://127.0.0.1:3737'};

    var client = new Client(config, {
      Connection:function(config){

        function WebSocket(url, options){

          this.close = function(code, reason){

          };

          this.send = function(message){

          };
        }

        this.prototype.send = function(message) {

          this.websocket.send(message);
        };

        this.prototype.close = function(code, reason) {

          if (this.websocket) this.websocket.close(code, reason);
        };

        this.prototype.connect = function(url, options) {

          return new Promise((resolve) => {

            this.websocket = new WebSocket(url, options);

            this.websocket.on('close', (code, reason) => {
              this.emit('close', {code: code, reason: reason});
            });

            this.websocket.on('error', (error) => {
              this.emit('error', error);
            });

            this.websocket.on('message', (message) => {
              this.emit('message', message);
            });

            this.websocket.on('ping', (data) => {
              this.emit('ping', data);
            });

            this.websocket.on('pong', (data) => {
              this.emit('pong', data);
            });

            this.websocket.on('open', function () {
              this.emit('open');
              resolve();
            });
          });
        }
      }
    });

    client.on('connected', function(connection){
      done();
    });

    client.connect();
  });
});
