module.exports = {

  clone: obj => JSON.parse(JSON.stringify(obj)),

  pause: ms => new Promise(resolve => setTimeout(resolve, ms)),

  deserializeWsMessage: (message, mode) => {

    if (mode == 'uws') return JSON.parse(Buffer.from(message).toString());

    return JSON.parse(message);
  },

  serializeWsMessage: (message) => {

    return JSON.stringify(message);
  }
};
