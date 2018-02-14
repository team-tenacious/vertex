module.exports = {
  clone: obj => JSON.parse(JSON.stringify(obj)),
  pause: ms => new Promise(resolve => setTimeout(resolve, ms))
};
