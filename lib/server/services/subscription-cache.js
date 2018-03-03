const EventEmitter = require('events').EventEmitter;
const {ServerError} = require('../errors');
const Redis = require('ioredis');
const LRU = require("lru-cache");
const CONSTANTS = require('../../common/constants');

module.exports = class Cache extends EventEmitter {

  static get dependants() {
    return ['edge', 'subscription'];
  }

  constructor(server, logger, config) {
    super();
    this.logger = logger;
    this.config = config;
    this.defaults();
    this.validate();
    this.initializeLRU();
  }

  resetLRU() {

    if (this.lru) this.lru.reset();
  }

  initializeLRU() {

    this.lru = new LRU(this.config.lru);
  }

  async set(key, value) {

    if (this.STATE != CONSTANTS.CACHE_STATE.CONNECTED) throw new Error('Cache is not connected to database');

    await this.redis.sadd(key, value);

    return await this.redis.smembers(key);
  }

  async get(key) {

    if (this.STATE != CONSTANTS.CACHE_STATE.CONNECTED) throw new Error('Cache is not connected to database');

    if (this.lru.has(key)) return this.lru.get(key);

    var members = await this.redis.smembers(key);
    
    if (members == null) return [];

    this.lru.set(key, members);

    return members;
  }

  async remove(key, value) {

    this.lru.del(key);

    if (value) {
      await this.redis.srem(key, value);
      return this.redis.scard(key);//cardinality of set after delete is returned
    }
    else {
      await this.redis.del(key);
      return 0;//removed everything from the set - so should be 0 if this was successful
    }
  }

  onLRUDisposed(key, value) {

    this.emit('lru-disposed', {key: key, value: value});
  }

  async start() {

    this.STATE = CONSTANTS.CACHE_STATE.CONNECTING;

    return new Promise((resolve, reject) => {

      this.redis = new Redis(this.config.redis);

      this.redis.on('error', (err) => {
        if (this.STATE == CONSTANTS.CACHE_STATE.CONNECTING) reject(new Error('Failed to connect redis'));
        this.emit('redis-error', err);
      });

      this.redis.on('close', () => {
        this.STATE = CONSTANTS.CACHE_STATE.CLOSED;
      });

      this.redis.on('reconnecting', () => {
        this.STATE = CONSTANTS.CACHE_STATE.RECONNECTING;
      });

      this.redis.on('connect', () => {
        var oldState = this.STATE;
        this.STATE = CONSTANTS.CACHE_STATE.CONNECTED;
        if (oldState == CONSTANTS.CACHE_STATE.CONNECTING) resolve(this);
      });
    });
  }

  async stop() {
    this.redis.quit();
  }

  defaults() {

    this.config.lru = this.config.lru || {max: 5000};
    this.config.redis = this.config.redis || {};
    this.config.lru.dispose = this.onLRUDisposed.bind(this);
  }

  validate() {

  }
};
