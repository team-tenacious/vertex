var path = require('path');
var filename = path.basename(__filename);
var Hashring = require('../../../lib/server/services/hashring');
var expect = require('expect.js');
const EventEmitter = require('events').EventEmitter;

describe(filename, function () {

  var mockCluster =  new EventEmitter();

  mockCluster.listPeers = function(){
    return ['10:0.0.1:5000','10:0.0.2:5000','10:0.0.3:5000','10:0.0.4:5000'];
  };

  function mockServer() {

    return {
      services: {
        cluster: mockCluster
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

  it('starts the hashring service, checks we are able to add and remove members - and list members', function (done) {

    var hashring = new Hashring(mockServer(), mockLogger(), mockConfig());

    hashring.memberJoined();
    hashring.memberJoined();
    hashring.memberJoined();
    hashring.memberJoined();

    hashring.memberLeft('10:0.0.4:5000');

    var gotMembers = hashring.listMembers('1234');

    expect(gotMembers.length).to.be(1);

    expect(['10:0.0.1:5000','10:0.0.2:5000','10:0.0.3:5000','10:0.0.4:5000'].indexOf(gotMembers[0]) > -1).to.be(true);

    gotMembers = hashring.listMembers('1234', {range:3});

    expect(gotMembers.length).to.be(3);

    done();
  });
});
