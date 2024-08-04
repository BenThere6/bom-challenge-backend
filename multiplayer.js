const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const multiplayerRouter = express.Router();
let io;

// Store active game sessions
const gameSessions = {};

const initializeMultiplayer = (server) => {
  io = new Server(server);

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on('createGame', () => {
      const sessionId = uuidv4().slice(0, 5).toUpperCase();
      gameSessions[sessionId] = {
        host: socket.id,
        players: [socket.id],
        round: 1,
        state: {}
      };
      socket.join(sessionId);
      socket.emit('gameCreated', sessionId);
      console.log(`Game created with session ID: ${sessionId}`);
    });

    socket.on('joinGame', (sessionId) => {
      if (gameSessions[sessionId]) {
        gameSessions[sessionId].players.push(socket.id);
        socket.join(sessionId);
        io.to(sessionId).emit('playerJoined', gameSessions[sessionId].players);
        console.log(`Player joined game with session ID: ${sessionId}`);
      } else {
        socket.emit('error', 'Invalid session ID');
      }
    });

    socket.on('submitGuess', (sessionId, guess) => {
      if (gameSessions[sessionId]) {
        // Handle guess submission and score calculation
        io.to(sessionId).emit('guessSubmitted', socket.id, guess);
      } else {
        socket.emit('error', 'Invalid session ID');
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Handle player disconnection and cleanup if necessary
    });
  });
};

// Define a route for getting active sessions (for testing purposes)
multiplayerRouter.get('/sessions', (req, res) => {
  res.json(gameSessions);
});

module.exports = { initializeMultiplayer, multiplayerRouter };