const uuid = require('uuid/v4');
const PushNotifications = require('@pusher/push-notifications-server');

const beamsClient = new PushNotifications({
  instanceId: '8ad9b796-b0fe-4936-83bd-cde6d460f800',
  secretKey: String(process.env.PUSHER_KEY)
});

const Player = require('./player');
// testuser4: 2d817cfb-131f-400b-84ce-4f03b49c5bda
// game user: 9180d31f-16b2-4adf-b2bd-b74cd47374e4
class Game{

  constructor(players){
    this.id = uuid();
    this.players = players;
  }

  //create game method
  create(socket){
    //get the io object
    let io = socket.server;
    //if the user is not already in a game then
    if(typeof Object.keys(socket.rooms)[1] !== undefined){
      //add user to a game specific room
      socket.join(this.id, () => {

          for(let i = 0; i < this.players.length; i++){
              //send push notification
              beamsClient.publishToUsers(this.players, {
                // fcm: {
                //   notification: {
                //     title: 'Game Invitation',
                //     body: "You've been invited to game " + this.id,
                //     click_action: "JOIN_GAME"
                //   },
                  data:{
                    gameID: this.id,
                    title: 'Game Invitation',
                    body: this.creator.firstName + ' ' + this.creator.lastName + ' has invited you to a game',
                    game: this
                  }
                }
              }).then((publishResponse) => {
                console.log('Sent notification to ' + this.players[i]);
              }).catch((error) => {
                console.error('Error:', error);
              });
              // //send push notification
              // beamsClient.publishToUsers(this.players, {
              //   fcm: {
              //     notification: {
              //       title: 'Game Invitation',
              //       body: "You've been invited to game " + this.id,
              //       click_action: "JOIN_GAME"
              //     },
              //   }
              // }).then((publishResponse) => {
              //   console.log('Sent notification to ' + this.players[i]);
              // }).catch((error) => {
              //   console.error('Error:', error);
              // });
          }
          //add the creator to the list of players
          this.players.push(socket.player);
          //add creator as creator
          this.creator = socket.player.user;
          //link the game object to the room
          io.sockets.adapter.rooms[this.id].game = this;
          //log to the console that the game has been created
          console.log(socket.player.user.firstName + " " + socket.player.user.lastName + " has created game: " + this.id );
          //emit to the game room that the game has been created
          io.to(this.id).emit('gameCreated',{message: "[" + this.id + "]: Game has been created", game:Game.cleanGame(this)});

      });
    }else{
      //if the user is in a game then throw an exception
      throw new Error(socket.player.user.firstName + " " + socket.player.user.lastName + " is already in a game: " + Object.keys(socket.rooms)[1]);
    }
  }

  //leave game method
  leave(socket, tempLeave){
    let io = socket.server;
    //if it's a temporary leave then we can set the player's element in the players array to their id
    if(tempLeave){
      let pIndex = this.players.indexOf(socket.player)
      this.players.splice(pIndex, 1, socket.player.user.id);
    }else{
      let pIndex = this.players.indexOf(socket.player)
      this.players.splice(pIndex, 1);
    }
    //remove the player from the game room
    socket.leave(this.id);
    //emit to the room that the user has left
    io.to(this.id).emit('userLeft',{message: "[" + this.id + "]: " + socket.player.user.firstName + " " + socket.player.user.lastName + " has left the game.", game:Game.cleanGame(this)});
    //inform the user they have left the game successfully.
    socket.emit('gameLeft', {message:"Left game " + this.id});
  }

  //check if the game is ready
  ready(){
    let gameReady = true;
    this.players.forEach((p) => {
      if(typeof p === 'string'){
        gameReady = false;
      }
    });
    return gameReady
  }

  start(){
    //send push notifications to everyone
    console.log("Game Ready");
  }

  //join game static method
  static join(socket, id, photo){
    //get the io object
    let io = socket.server;
    //if the room is defined
    if(io.sockets.adapter.rooms[id] != null){
      //get the game object from the room
      let game = io.sockets.adapter.rooms[id].game;
      //set the user's photo and game in the player object
      socket.player.photo = photo;
      // socket.player.game = game;
      //if the invited players array contains the user's id who is trying to connect
      if(game.players.includes(socket.player.user.id)){
        //add player to the room
        socket.join(game.id, () => {
          //replace the id with the players full object
          game.players.splice(game.players.indexOf(socket.player.user.id), 1, socket.player);
          //emit to the room that the user has joined the game
          io.to(game.id).emit('userJoined', {message: "[" + game.id + "]: " + socket.player.user.firstName + " " + socket.player.user.lastName + " has joined.", game: Game.cleanGame(game) });
          //inform the user they have joined the game successfully.
          socket.emit('gameJoined', {message:"Joined game " + game.id});
          if(game.ready()){
            game.start();
          }
        });
      }else{
        //if the player is not invited to the room then throw an error
        socket.emit("err", { type: "gameNotInvited", message: "You haven't been invited to the game you're trying to connected to."});
      }
    }else{
      //if the room is not defined then throw an error
      socket.emit("err", { type: "gameNotFound", message: "The game you are trying to connect to is not found."});
    }
  }

  //decline game method to remove user from a game
  static decline(socket, id){
    //get the io object
    let io = socket.server;
    //if the room is defined
    if( io.sockets.adapter.rooms[id] != null){
      //get the game object
      let game = io.sockets.adapter.rooms[id].game;
      //remove player from the game
      let pIndex = game.players.indexOf(socket.player.user.id)
      if (pIndex > -1) {
         game.players.splice(pIndex, 1);
      }
      console.log("[" + game.id + "]: " + socket.player.user.firstName + " " + socket.player.user.lastName + " has declined the invitation to game " + game.id +".")
      //emit to the room that the user has joined the game
      io.to(game.id).emit('userDeclined', {message: "[" + game.id + "]: " + socket.player.user.firstName + " " + socket.player.user.lastName + " has declined the game invitation.", game: Game.cleanGame(game) });
      //inform the user they have joined the game successfully.
      socket.emit('gameDeclined', {message:"Declined game " + game.id});
      //check if the game is ready to start
      if(game.ready()){
        game.start();
      }
    }else{
      //if the room is not defined then throw an error
      socket.emit("err", { type: "gameNotFound", message: "The game you are trying to decline is not found."});
    }
  }

  //clean game method (strips out the tokens or any features that user could use to abuse the system)
  static cleanGame(game){
    let gameCopy = game;
    delete gameCopy.creator.password;
    delete gameCopy.creator.active;
    delete gameCopy.creator.email;
    delete gameCopy.creator.verified;
    gameCopy.players.forEach((p) => {
      delete p.token;
      if (p.hasOwnProperty("user")){
        delete p.user.password;
        delete p.user.active;
        delete p.user.email;
        delete p.user.verified;
      }
    })
    return gameCopy;
  }
}

module.exports = Game;
