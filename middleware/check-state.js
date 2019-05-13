const fs = require('fs');

const Player = require('../models/player')
const Game = require('../models/game')

module.exports = (socket,next) => {
  if(fs.existsSync('./state/' + socket.player.user.id + '.json')){
    fs.readFile('./state/'+ socket.player.user.id +'.json', (err, data) => {
      if (err) throw err;
      let dataObj = JSON.parse(data);
      if(dataObj.game !== ""){
        console.log(socket.player.user.firstName + " is joining " + dataObj.game );
        Game.join(socket, dataObj.game, dataObj.photo);
      }
    });
  }
  next();
};
