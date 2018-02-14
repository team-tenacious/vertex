var path = require('path');
var filename = path.basename(__filename);
var Cache = require('../../../lib/server/services/cache');
var expect = require('expect.js');

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

  it('starts and stops the cache service', function (done) {

    var cache = new Cache(mockServer(), mockLogger(), mockConfig());

    cache.start()
      .then(function () {
        return cache.stop();
      }).then(done)
      .catch(done);
  });

  it('adds, finds and removes an item from the cache service', function (done) {

    var cache = new Cache(mockServer(), mockLogger(), mockConfig());

    cache.start()
      .then(function () {
        return cache.set('test1', {value: 'test1'});
      })
      .then(function () {
        return cache.get('test1');
      })
      .then(function (value) {
        expect(value).to.eql({value: 'test1'});
        return cache.remove('test1');
      })
      .then(function () {
        return cache.get('test1');
      })
      .then(function (value) {
        expect(value).to.be(null);
        done();
      })
      .catch(done);
  });
});
