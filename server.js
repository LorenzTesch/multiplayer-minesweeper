const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('./public'));



var games = {};


function ran(max, min = 0){
    return Math.floor(Math.random() * (max-min)) + min
}

function createRoom(){
    var n = ran(99999, 10000);
    if(games[n]){
        return createRoom();
    }
    games[n] = {};
    return n
}

function getNeighbours(j, sx, sy){

    const p = (_i) => {
        var _y = Math.floor(_i / sx);
        var _x = _i - _y * sx;
        return {
            x: _x,
            y: _y
        }
    };

    var res = [];

    if(p(j).y === p(j-1).y){ //w
        res.push(j-1);
    }

    if(p(j).y === p(j+1).y){ //o
        res.push(j+1);
    }

    if(p(j-sx).y >= 0){ //n
        res.push(j-sx);
    }

    if(p(j+sx).y < sy){ //s
        res.push(j+sx);
    }

    if(p(j-sx-1).y >= 0 && p(j).y === p(j-sx-1).y + 1){ //nw
        res.push(j-sx-1);
    }

    if(p(j-sx+1).y >= 0 && p(j).y === p(j-sx+1).y + 1){ //no
        res.push(j-sx+1);
    }

    if(p(j+sx-1).y < sy && p(j).y === p(j+sx-1).y - 1){ //sw
        res.push(j+sx-1);
    }

    if(p(j+sx+1).y < sy && p(j).y === p(j+sx+1).y - 1){ //so
        res.push(j+sx+1);
    }

    return res;

}

class Game{

    constructor(sx, sy, numMines){

        this.sx = sx;
        this.sy = sy;
        this.numMines = numMines;

        this.room = createRoom();

        var map = new Array(sx * sy).fill(0);

        // TODO: make O(n)
        for(let i = 0; i < numMines; i++){

            let j = ran(map.length);

            if(map[j] === 9){
                i--;
            }else{
                map[j] = 9;

                for(var _i of getNeighbours(j, this.sx, this.sy)){

                    if(map[_i] < 8){
                        map[_i]++;
                    }

                }

            }

        }

        console.log(map);

        this.map = map;

        games[this.room] = this;

        this.revealed = new Map();

    }

    reveal(x, y, i=null){

        if(i == null){
            i = y * this.sx + x;
        }

        if(this.revealed.get(i) !== undefined){return}

        if(this.revealed.size === 0 && this.map[i] !== 0){

            // make sure first reveal is 0

        }

        var value = this.map[i];

        this.revealed.set(i, value);

        io.to(this.room).emit('reveal', {
            index: i,
            value: value
        })

        if(value === 0){
            for(var _i of getNeighbours(i, this.sx, this.sy)){
                this.reveal(undefined, undefined, _i);
            }
        }else if(value === 9){
            this.end(false);
        }

        var tilesLeft = this.map.length - this.revealed.size;

        if(value !== 9 && tilesLeft === this.numMines){
            this.end(true);
        }

    }

    end(won){

        console.log('game over. won:', won);

        if(won === true){

            io.to(this.room).emit('gameover', {
                won: true
            })

        }else{

            io.to(this.room).emit('gameover', {
                won: false
            })

        }

        delete games[this.room];

    }

    i2c(_i){

        var _y = Math.floor(_i / this.sx);
        var _x = _i - _y * this.sx;
        return {
            x: _x,
            y: _y
        }

    }

}


io.on('connection', (socket) => {
  
    socket.on('game_new', (data)=>{

        var {sx, sy, numMines} = data;

        if(sx * sy <= numMines){return}

        if(sy > sx){
            let temp = sy;
            sy = sx;
            sx = temp;
        }

        var room = new Game(sx, sy, numMines).room;

        socket.join(room);
        socket.data.room = room;

        socket.emit('game_join_success', {
            sx: games[room].sx,
            sy: games[room].sy,
            revealed: games[room].revealed
        });

    })

    socket.on('game_join', (data)=>{

        var { room } = data;

        if(!games[room]){
            return socket.emit('game_join_invalid');
        }

        socket.join(room);
        socket.data.room = room;

        socket.emit('game_join_success', {
            sx: games[room].sx,
            sy: games[room].sy,
            revealed: games[room].revealed
        });

    })

    socket.on('game_action_reveal', (data)=>{

        var { x, y } = data;

        var game = games[socket.data.room];

        if(game){
            game.reveal(x, y);
        }

    })

});

server.listen(80, () => {
  console.log('listening on :80');
});