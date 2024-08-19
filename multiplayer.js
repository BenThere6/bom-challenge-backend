const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const multiplayerRouter = express.Router();
let io;

// Load the verses and their indexes from the CSV file
const verses = [];
const loadVerses = () => {
  const csvPath = path.join(__dirname, 'data', 'verses.csv');
  const data = fs.readFileSync(csvPath, 'utf-8');
  const lines = data.split('\n');
  lines.forEach((line, index) => {
    const [reference, verse] = line.split(',');
    verses.push({ reference, verse, index });
  });
};

loadVerses(); // Load the verses into memory

// Store active game sessions
const gameSessions = {};

const initializeMultiplayer = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://lehislegacy.netlify.app',
        'https://lehislegacy.netlify.app',
        'http://lehislegacy.com',
        'https://lehislegacy.com',
        'http://localhost:5173',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on('createGame', () => {
      const sessionId = uuidv4().slice(0, 5).toUpperCase();
      gameSessions[sessionId] = {
        host: socket.id,
        players: [{ id: socket.id, score: 0 }],
        rounds: 5, // You can adjust the default number of rounds
        currentRound: 0,
        state: {},
        correctVerseIndex: Math.floor(Math.random() * verses.length), // Randomly select a correct verse index
      };
      socket.join(sessionId);
      socket.emit('gameCreated', sessionId);
      console.log(`Game created with session ID: ${sessionId}`);
    });

    socket.on('joinGame', (sessionId) => {
      if (gameSessions[sessionId] && gameSessions[sessionId].players.length < 8) {
        gameSessions[sessionId].players.push({ id: socket.id, score: 0 });
        socket.join(sessionId);
        io.to(sessionId).emit('playerJoined', gameSessions[sessionId].players);
        console.log(`Player joined game with session ID: ${sessionId}`);
      } else {
        socket.emit('error', 'Invalid session ID or game is full');
      }
    });

    socket.on('startGame', (sessionId, rounds) => {
      const session = gameSessions[sessionId];
      if (session && session.host === socket.id) {
        session.currentRound = 1;
        io.to(sessionId).emit('gameStarted', { rounds: session.rounds });
        startRound(sessionId);
      }
    });

    socket.on('submitGuess', (sessionId, guessedVerseIndex) => {
      const session = gameSessions[sessionId];
      if (session) {
        const player = session.players.find((p) => p.id === socket.id);
        if (player) {
          player.guess = guessedVerseIndex; // Store the player's guess
          io.to(sessionId).emit('guessSubmitted', { playerId: socket.id, guess: guessedVerseIndex });
          checkRoundEnd(sessionId);
        }
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

const startRound = (sessionId) => {
  const session = gameSessions[sessionId];
  if (session) {
    io.to(sessionId).emit('roundStarted', session.currentRound);

    // Start a timer for the round
    const roundTimer = setTimeout(() => {
      endRound(sessionId);
    }, 60000); // 60 seconds per round (adjust as needed)

    session.state.timer = roundTimer;
  }
};

const endRound = (sessionId) => {
  const session = gameSessions[sessionId];
  if (session) {
    clearTimeout(session.state.timer);

    // Rank players based on their distance from the correct verse
    const correctVerseIndex = session.correctVerseIndex;
    session.players.forEach((player) => {
      player.distance = Math.abs(correctVerseIndex - player.guess);
    });

    // Sort players by distance from the correct verse (smallest distance first)
    session.players.sort((a, b) => a.distance - b.distance);

    // Assign points based on their rank
    let points = 100;
    session.players.forEach((player, index) => {
      if (index > 0 && player.distance === session.players[index - 1].distance) {
        // If this player has the same distance as the previous player, they get the same points
        player.score += points;
      } else {
        // Otherwise, decrement points by 10 for each subsequent player
        player.score += points;
        points = Math.max(0, points - 10); // Decrease points but ensure it doesn't go below 0
      }
    });

    io.to(sessionId).emit('roundEnded', session.currentRound, session.players);

    if (session.currentRound < session.rounds) {
      session.currentRound++;
      // Choose a new correct verse for the next round
      session.correctVerseIndex = Math.floor(Math.random() * verses.length);
      startRound(sessionId);
    } else {
      endGame(sessionId);
    }
  }
};

const checkRoundEnd = (sessionId) => {
  const session = gameSessions[sessionId];
  if (session) {
    // Check if all players have submitted their guesses
    const allGuessesIn = session.players.every((p) => p.guessSubmitted);
    if (allGuessesIn) {
      endRound(sessionId);
    }
  }
};

const endGame = (sessionId) => {
  const session = gameSessions[sessionId];
  if (session) {
    // Calculate final scores and determine the winner
    session.players.sort((a, b) => b.score - a.score);
    io.to(sessionId).emit('gameEnded', session.players);

    // Clean up session data
    delete gameSessions[sessionId];
  }
};

// const calculatePoints = (correctVerseIndex, guessedVerseIndex) => {
//   const maxScore = 100;
//   const distance = Math.abs(correctVerseIndex - guessedVerseIndex);
//   return Math.max(0, maxScore - distance);
// };

// Define a route for getting active sessions (for testing purposes)
multiplayerRouter.get('/sessions', (req, res) => {
  res.json(gameSessions);
});

module.exports = { initializeMultiplayer, multiplayerRouter };