const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config()

const app = express();

// parse application/json
app.use(bodyParser.json())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))

// use cors options
app.use(cors())

// socket io
const httpServer = require("http").createServer(app)
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// clients
const clients = []
const meets = []
meets.push({
  id: 'public_demo',
  name: 'Public Demo Meet Room',
  players: [],
})


// funcs
Array.prototype.remove = function() {
  var what, a = arguments, L = a.length, ax;
  while (L && this.length) {
      what = a[--L];
      while ((ax = this.indexOf(what)) !== -1) {
          this.splice(ax, 1);
      }
  }
  return this;
};

//  socket
function getClient(socketId) {
  const clientIndex = clients.findIndex(e => e.id === socketId)
  return clients[clientIndex]
}
function displayClientCount() {
  console.log(`[server] : client online: ${clients.length}`)
}
function displayMeetClientCount(meet) {
  console.log(`[server] : client online in "${meet.id}" : "${meet.players.length}"`)
}
function clientConnected(socket) {
  console.log(`[server] : client "${socket.id}" connected`)
  clients.push({
    id: socket.id,
    socket
  })
  displayClientCount()
}
io.on("connection", (socket) => {
  // client - connected
  clientConnected(socket)

  // client - joined
  socket.on("join", (data) => {
    if (data && data.meetId && data.username) {
      const { meetId } = data
      const client = getClient(socket.id)
      const meetIndex = meets.findIndex(e => e.id === meetId)
      const meet = meets[meetIndex]
      if (meetIndex > -1) {
        const meet = meets[meetIndex]
        meet.players.push({
          client,
          name: data.username,
          data: {
            x: 220,
            y: 220,
            direction: 'bottom',
          }
        })
        socket.join(`room_${meetId}`)

        // notif if new client join
        io.to(`room_${meetId}`).emit('client-connected', socket.id)

        // apply joined
        socket.emit('joined', { id: meet.id, name: meet.name })
        console.log(`[server] : client "${socket.id}" joined "${meetId}"`)
        displayMeetClientCount(meet)
      }
    }
  })

  // client - update data
  socket.on("player-action", (d) => {
    if (d.meetId && d.action) {
      const { meetId } = d
      const meetIndex = meets.findIndex(e => e.id === meetId)
      const meet = meets[meetIndex]
      if (meetIndex > -1) {
        const meet = meets[meetIndex]
        const clientIndex = meet.players.findIndex(e => e.client.id === socket.id)
        if (clientIndex > -1) {
          switch (d.action) {
            case 'move':
              const data = d.data || { x: 0, y: 0, direction: 'bottom' }
              meet.players[clientIndex].data = data
              io.to(`room_${meet.id}`).emit('player-action', {
                action: 'move',
                id: socket.id,
                data,
              })
              break;
          
            default:
              break;
          }
        }
      }
    }
  })

  // client - disconnected
  socket.on("disconnect", (data) => {
    if(data !== null){
      console.log(`[server] : client "${socket.id}" disconnected`)
    }
    // remove client in meet
    for (let i = 0; i < meets.length; i++) {
      const meet = meets[i];
      const clientIndex = meet.players.findIndex(e => e.client.id === socket.id)
      if (clientIndex > -1) meets[i].players.splice(clientIndex, 1)
    }

    // remove client
    const clientIndex = clients.findIndex(e => e.id === socket.id)
    if (clientIndex > -1) clients.splice(clientIndex, 1)
    displayClientCount()
  })
})


// services
let timer
function update() {
  // meet player update list
  for (let i = 0; i < meets.length; i++) {
    const meet = meets[i];

    // update client list in this meet
    const meetClientList = meet.players.map(e => { return {id: e.client.id, name: e.name, data: e.data} })
    io.to(`room_${meet.id}`).emit('client-list', { clientList: meetClientList })
    // console.log(meetClientList)
  }
  timer = setTimeout(update, 1000)
}


// listening port
const PORT = process.env.PORT || 8000
httpServer.listen(PORT)
timer = setTimeout(update, 200)