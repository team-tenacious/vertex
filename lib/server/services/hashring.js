const {ServerError} = require('../errors');
const HashRing = require('hashring');

module.exports = class Hashring {

  static get dependants() { return []; }

  constructor(server, logger, config) {
    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
    this.hashRing = this.initializeHashring();
  }

  initializeHashring(members) {
    this.hashRing = new HashRing(members);
  }

  addMember(member){
    return this.hashRing.add(member);
  }

  removeMember(member){
    return this.hashRing.remove(member);
  }

  defaults() {

  }

  validate() {

  }
};
