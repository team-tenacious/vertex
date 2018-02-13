const { Server } = require('../');

module.exports = function (seq) {

  Server.create({
      logger: {
        level: 'info',
        // level: (d) => { // loglevel functor
        //   console.log(d);
        //   return 'info'
        // }
      },
      services: {
        tcp: {
          host: '127.0.0.1',
          port: 60606 + seq
        },
        cluster: {
          seed: seq == 0,
          join: ['127.0.0.1:60606', '127.0.0.1:60607', '127.0.0.1:60608']
        }
      }
    })

    .then(server => {
      function terminate(opts) {
        console.log();

        server.stop().catch(function (err) {
          console.error(err);
          process.exit(1);
        });
      };

      process.on('SIGINT', terminate);
      process.on('SIGTERM', terminate);
    })

    .catch(err => {
      process.exit(1);
    });

}
