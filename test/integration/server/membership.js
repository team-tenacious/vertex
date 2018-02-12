const { Server } = require('../../../');

describe('integration - server - membership', function () {

  var seq = 0;

  before('start servers', async function () {

    function createConfig(seq) {
      return {
        services: {
          membership: {
            seed: seq == 1,
          }
        }
      }
    }

    this.servers = await Promise.all([
      Server.create(createConfig(seq++)) /*,
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)),
      Server.create(createConfig(seq++)) */
    ])

  });

  after('stop servers', async function () {

    for (var i = 0; i < this.servers.length; i++) {
      await this.servers[i].stop();
    }

  });

  it('fully connected the members', function () {

  });

  it('emits on member arrival');

  it('emits on member departure');

});
