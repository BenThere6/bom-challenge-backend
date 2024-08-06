const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer'); // Add this line
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://lehislegacy.netlify.app',
      'https://lehislegacy.netlify.app',
      'http://lehislegacy.com',
      'https://lehislegacy.com',
      'http://localhost',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

const leaderboardRouter = express.Router();
const adminRouter = express.Router();
const feedbackRouter = express.Router();
const multiplayerRouter = express.Router();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// Verify Origin Middleware
const verifyOrigin = (req, res, next) => {
  const allowedOrigins = [
    'http://lehislegacy.netlify.app',
    'https://lehislegacy.netlify.app',
    'http://lehislegacy.com',
    'https://lehislegacy.com',
    'http://localhost',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    const isAllowed = allowedOrigins.some((allowedOrigin) => origin.startsWith(allowedOrigin));
    if (!isAllowed) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }
  next();
};

app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    verifyOrigin(req, res, next);
  } else {
    next();
  }
});

// Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    console.log('Authorization header is missing');
    return res.status(401).json({ message: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    console.log('Token is missing in authorization header');
    return res.status(401).json({ message: 'Token is missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || user.role !== 'admin') {
      console.log('Invalid token or user is not admin:', err);
      return res.status(403).json({ message: 'Forbidden' });
    }

    req.user = user;
    next();
  });
};

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS // Your email password
  }
});

// Function to send email
const sendEmailNotification = (username, score, difficulty, category) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'benbirdsall7@gmail.com',
    subject: 'New Score Posted',
    text: `A new score has been posted:\n\nUsername: ${username}\nScore: ${score}\nDifficulty: ${difficulty}\nCategory: ${category}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

// Multiplayer Routes
multiplayerRouter.post('/create', async (req, res) => {
  const { gameId, players } = req.body;
  try {
    await pool.query('INSERT INTO multiplayer_games (game_id, players, created_at) VALUES (?, ?, ?)', [gameId, JSON.stringify(players), new Date()]);
    res.status(201).json({ message: 'Game created successfully' });
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

multiplayerRouter.post('/update', async (req, res) => {
  const { gameId, gameState } = req.body;
  try {
    await pool.query('UPDATE multiplayer_games SET game_state = ?, updated_at = ? WHERE game_id = ?', [JSON.stringify(gameState), new Date(), gameId]);
    res.status(200).json({ message: 'Game state updated successfully' });
  } catch (err) {
    console.error('Error updating game state:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

multiplayerRouter.get('/state/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    const [rows] = await pool.query('SELECT game_state FROM multiplayer_games WHERE game_id = ?', [gameId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json(JSON.parse(rows[0].game_state));
  } catch (err) {
    console.error('Error fetching game state:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use('/leaderboard', leaderboardRouter);
app.use('/admin', adminRouter);
app.use('/feedback', feedbackRouter);
app.use('/multiplayer', multiplayerRouter);

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('joinGame', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game ${gameId}`);
  });

  socket.on('leaveGame', (gameId) => {
    socket.leave(gameId);
    console.log(`User ${socket.id} left game ${gameId}`);
  });

  socket.on('gameStateUpdate', (gameId, gameState) => {
    io.to(gameId).emit('gameStateUpdate', gameState);
    console.log(`Game state updated for game ${gameId}`);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

leaderboardRouter.post('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  const { username, score } = req.body;

  console.log('Received new score:', { username, score, difficulty, category });

  if (score === 0) {
    console.log('Score of 0 will not be posted to the leaderboard.');
    return res.status(400).json({ message: 'Score of 0 will not be posted to the leaderboard.' });
  }

  try {
    await pool.query(
      'INSERT INTO leaderboard (username, score, difficulty, category) VALUES (?, ?, ?, ?)',
      [username, score, difficulty, category]
    );
    res.status(201).json({ message: 'Score saved successfully' });

    console.log('Score saved successfully:', { username, score, difficulty, category });

    // Send email notification
    sendEmailNotification(username, score, difficulty, category);
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});