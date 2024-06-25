const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const router = express.Router();

const leaderboardPath = path.join(__dirname, 'leaderboard.json');

// Helper function to read leaderboard data
const readLeaderboard = () => {
  try {
    if (!fs.existsSync(leaderboardPath)) {
      fs.writeFileSync(leaderboardPath, JSON.stringify([]));
    }

    const data = fs.readFileSync(leaderboardPath, 'utf-8');
    if (data.trim() === '') {
      return [];
    }

    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading or parsing leaderboard.json:', err);
    return [];
  }
};

// Helper function to write leaderboard data
const writeLeaderboard = (data) => {
  fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
};

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// Get top 10 scores
router.get('/leaderboard', (req, res) => {
  const leaderboard = readLeaderboard();
  const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  res.json(topScores);
});

// Save a new score
router.post('/leaderboard', (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    return res.status(400).json({ message: 'Invalid input' });
  }

  const leaderboard = readLeaderboard();
  leaderboard.push({ username, score, created_at: new Date().toISOString() });
  writeLeaderboard(leaderboard);

  const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  res.json(topScores);
});

app.use('/.netlify/functions/leaderboard', router);

module.exports.handler = serverless(app);