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

    socket.on('createGame', ({ difficulty, rounds }) => {
      const sessionId = uuidv4().slice(0, 5).toUpperCase();
      gameSessions[sessionId] = {
        host: socket.id,
        players: [{ id: socket.id, score: 0 }],
        difficulty,
        rounds,
        currentRound: 0,
        state: {},
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

    socket.on('startGame', (sessionId) => {
      const session = gameSessions[sessionId];
      if (session && session.host === socket.id) {
        session.currentRound = 1;
        io.to(sessionId).emit('gameStarted', { difficulty: session.difficulty, rounds: session.rounds });
        startRound(sessionId);
      }
    });

    socket.on('submitGuess', (sessionId, guess) => {
      const session = gameSessions[sessionId];
      if (session) {
        const player = session.players.find((p) => p.id === socket.id);
        if (player) {
          // Here you should calculate the score based on the guess and correct verse
          const points = calculatePoints(guess, session.currentRound); // Placeholder function
          player.score += points;

          io.to(sessionId).emit('guessSubmitted', { playerId: socket.id, guess, points });
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

    io.to(sessionId).emit('roundEnded', session.currentRound, session.players);

    if (session.currentRound < session.rounds) {
      session.currentRound++;
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

const calculatePoints = (guess, round) => {
  // Implement your point calculation logic based on the guess and correct verse
  // For example, you could calculate the distance between the guessed verse and the correct one
  return Math.max(0, 100 - Math.abs(guess - correctVerse));
};

// Define a route for getting active sessions (for testing purposes)
multiplayerRouter.get('/sessions', (req, res) => {
  res.json(gameSessions);
});

module.exports = { initializeMultiplayer, multiplayerRouter };