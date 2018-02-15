const {ServerError} = require('../errors');
const HashRing = require('hashring');

module.exports = class Hashring {

  static get dependants() { return []; }

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
    this.initializeHashring();

    this.cluster = server.services.cluster;

    this.cluster.on('join', this.memberJoined.bind(this));
    this.cluster.on('leave', this.memberLeft.bind(this));
  }

  initializeHashring(members) {
    this.hashRing = new HashRing(members);
  }

  memberJoined(){
    this.initializeHashring(this.cluster.listPeers());
  }

  memberLeft(member){
    this.hashRing.remove(member);
  }

  listMembers(key, options){

    if (options && options.range > 1) return this.hashRing.range(key, options.range);
    var gotSingle = this.hashRing.get(key);
    if (!gotSingle) return [];
    return [gotSingle];
  }

  defaults() {

  }

  validate() {

  }
};
