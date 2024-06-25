const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const router = express.Router();

// Ensure the leaderboard.json file is located in the correct directory relative to the serverless function.
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
  try {
    fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing to leaderboard.json:', err);
  }
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
router.get('/', (req, res) => {
  try {
    const leaderboard = readLeaderboard();
    const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
    res.json(topScores);
  } catch (err) {
    console.error('Error retrieving leaderboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save a new score
router.post('/', (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  try {
    const leaderboard = readLeaderboard();
    leaderboard.push({ username, score, created_at: new Date().toISOString() });
    writeLeaderboard(leaderboard);

    const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
    res.json(topScores);
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Use the router for the API routes
app.use('/.netlify/functions/leaderboard', router);

// Export the serverless function handler
module.exports.handler = serverless(app);