const { Server } = require('../');

module.exports = function (seq) {

  const seqInt = parseInt(seq);

  Server.create({
      name: 'node-' + seq,
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        // level: (d) => { // loglevel functor
        //   console.log(d);
        //   return 'info'
        // }
      },
      services: {
        tcp: {
          host: '127.0.0.1',
          port: 60606 + seqInt
        },
        cluster: {
          secret: 'xxx',
          seed: seqInt == 0,
          join: ['127.0.0.1:60606', '127.0.0.1:60607', '127.0.0.1:60608']
        },
        http: {
          port: 3737 + seqInt
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
