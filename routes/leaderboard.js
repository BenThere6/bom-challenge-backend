// routes/leaderboard.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const leaderboardPath = path.join(__dirname, '../data/leaderboard.json');

// Helper function to read leaderboard data
const readLeaderboard = () => {
  const data = fs.readFileSync(leaderboardPath, 'utf-8');
  return JSON.parse(data);
};

// Helper function to write leaderboard data
const writeLeaderboard = (data) => {
  fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
};

// Get top 10 scores
router.get('/', (req, res) => {
  const leaderboard = readLeaderboard();
  const topScores = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  res.json(topScores);
});

// Save a new score
router.post('/', (req, res) => {
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

module.exports = router;