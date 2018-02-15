var path = require('path');
var filename = path.basename(__filename);
var Http = require('../../../lib/server/services/http');

describe(filename, function () {

  function mockServer() {

    return {
      services: {}
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

  it('starts and stops the http service', function (done) {

    var http = new Http(mockServer(), mockLogger(), mockConfig());

    http.start()
      .then(function () {
        return http.stop();
      }).then(done)
      .catch(done);
  });
});
