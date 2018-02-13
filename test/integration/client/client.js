var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;

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

  class Connection extends EventEmitter {

    constructor() {
      super();
    }

    send(message) {

    }

    close(code, reason) {
      this.emit('close', {code: code, reason: reason});
    }

    connect(url, options) {
      return new Promise((resolve) => {
        resolve();
      });
    }
  }

  it('mocks the connection uses it to test the client connect', function (done) {

    this.timeout(10000);

    var Client = require('../../..').Client;

    var config = {url:'ws://127.0.0.1:3737'};

    var client = new Client(config, {
      Connection:Connection
    });

    // client.on('all', function(event){
    //   console.log(event.key, event.data);
    // });
    //
    client.on('connected', function(){
      done();
      //setTimeout(done, 5000);
    });

    client.connect();
  });

  it('mocks the connection uses it to test the client disconnect', function (done) {

    this.timeout(10000);

    var Client = require('../../..').Client;

    var config = {url:'ws://127.0.0.1:3737'};

    var client = new Client(config, {
      Connection:Connection
    });

    // client.on('all', function(event){
    //   console.log(event.key, event.data);
    // });
    //
    client.on('connected', function(){

      client.on('close', function(info){
        expect(info.code).to.be(1);
        expect(info.reason).to.be('intentional disconnect test');
        done();
      });

      client.disconnect({code: 1, reason: 'intentional disconnect test'});
    });

    client.connect();
  });
});
