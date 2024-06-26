const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const router = express.Router();

// Ensure the leaderboard.json file is located in the correct directory relative to the serverless function.
const leaderboardPath = path.join('/tmp', 'leaderboard.json');

// Helper function to read leaderboard data
const readLeaderboard = () => {
  try {
    console.log(`Reading leaderboard data from ${leaderboardPath}`);
    if (!fs.existsSync(leaderboardPath)) {
      fs.writeFileSync(leaderboardPath, JSON.stringify([]));
      console.log(`Created new leaderboard file at ${leaderboardPath}`);
    }

    const data = fs.readFileSync(leaderboardPath, 'utf-8');
    if (data.trim() === '') {
      console.log('Leaderboard file is empty, returning empty array');
      return [];
    }

    console.log('Leaderboard data read successfully');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading or parsing leaderboard.json:', err);
    return [];
  }
};

// Helper function to write leaderboard data
const writeLeaderboard = (data) => {
  try {
    console.log('Writing leaderboard data to file');
    fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
    console.log('Leaderboard data written successfully');
  } catch (err) {
    console.error('Error writing to leaderboard.json:', err);
    throw err; // Propagate the error back
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
    console.log('Top scores:', topScores);
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
    console.error('Invalid input: username and score are required');
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  try {
    console.log('Received new score:', { username, score });
    const leaderboard = readLeaderboard();
    leaderboard.push({ username, score, created_at: new Date().toISOString() });
    writeLeaderboard(leaderboard);

    const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
    console.log('Updated top scores:', topScores);
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
