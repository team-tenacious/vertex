var path = require('path');
var filename = path.basename(__filename);
var Cache = require('../../../lib/server/services/subscription-cache');
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

  it.only('adds, finds and removes an item from the cache service', function (done) {

    var cache = new Cache(mockServer(), mockLogger(), mockConfig());

    cache.start()
      .then(function () {
        return cache.set('test1', 'test1');
      })
      .then(function () {
        return cache.set('test1', 'test2');
      })
      .then(function () {
        return cache.get('test1');
      })
      .then(function (value) {
        expect(value.sort()).to.eql(['test1', 'test2']);
        return cache.remove('test1', 'test1');
      })
      .then(function () {
        return cache.get('test1');
      })
      .then(function (value) {
        expect(value).to.eql(['test2']);
      })
      .then(function () {
        return cache.remove('test1');
      })
      .then(function () {
        return cache.get('test1');
      })
      .then(function (value) {
        expect(value).to.eql([]);
        done();
      })
      .catch(done);
  });

  it('tree adds, finds and removes an item from the cache service', function (done) {

    var cache = new Cache(mockServer(), mockLogger(), mockConfig());

    cache.start()
      .then(function () {
        return cache.setTree('EDGE_SUBS:10:0.0.1:9000', 'test1', 'test1');
      })
      .then(function () {
        return cache.setTree('EDGE_SUBS:10:0.0.1:9000', 'test1', 'test2');
      })
      .then(function () {
        return cache.getTree('EDGE_SUBS:10:0.0.1:9000', 'test1');
      })
      .then(function (value) {
        expect(value).to.eql(['test1', 'test2']);
        return cache.removeTree('EDGE_SUBS:10:0.0.1:9000', 'test1', 'test1');
      })
      .then(function () {
        return cache.getTree('EDGE_SUBS:10:0.0.1:9000', 'test1');
      })
      .then(function (value) {
        expect(value).to.eql(['test2']);
        return cache.setTree('EDGE_SUBS:10:0.0.1:9000', 'test1', 'test3');
      })
      .then(function () {
        return cache.getTree('EDGE_SUBS:10:0.0.1:9000', 'test1');
      })
      .then(function (value) {
        expect(value).to.eql(['test2', 'test3']);
        return cache.removeTree('EDGE_SUBS:10:0.0.1:9000');
      })
      .then(function () {
        return cache.getTree('EDGE_SUBS:10:0.0.1:9000', 'test1');
      })
      .then(function (value) {
        expect(value).to.be([]);
        done();
      })
      .catch(done);
  });
});
