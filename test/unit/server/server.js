const {Server} = require('../../../');
const expect = require('expect.js');

describe('unit - server - server', function () {

  it('default service configs and sorts startup order', function () {

    var server = new Server({
      services: {
        xxx: {},
        yyy: {},
        membership: {}
      }
    });

    var sorted = server.sortServices();

    expect(sorted).to.eql([
      'sockets',
      'tcp',
      'cluster',
      'hashring',
      'http',
      'ws',
      'xxx',
      'yyy',
      'membership'
    ]);
  });

});
