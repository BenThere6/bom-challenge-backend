const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { authenticateToken, authenticateAdmin } = require('./authMiddleware');

const app = express();
const router = express.Router();

// Create a new pool using the local MySQL environment variables
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

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// API Routes

// Get top 10 scores for a specific difficulty and category
router.get('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  try {
    const [rows] = await pool.query('SELECT username, score, created_at FROM leaderboard WHERE difficulty = ? AND category = ? ORDER BY score DESC LIMIT 10', [difficulty, category]);
    res.json(rows);
  } catch (err) {
    console.error(`Error retrieving ${difficulty}-${category} leaderboard:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save a new score for a specific difficulty and category
router.post('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  const { username, score } = req.body;
  
  // Validate input
  if (!username || typeof score !== 'number') {
    console.error('Invalid input: username and score are required');
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO leaderboard (username, score, difficulty, category, created_at) VALUES (?, ?, ?, ?, ?)',
      [username, score, difficulty, category, new Date()]
    );
    
    // Fetch the newly inserted score
    const [newScore] = await pool.query('SELECT * FROM leaderboard WHERE id = ?', [result.insertId]);
    res.json(newScore[0]);
  } catch (err) {
    console.error(`Error saving score for ${difficulty}-${category}:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete all scores for a specific difficulty and category
router.delete('/:difficulty/:category/deleteall', async (req, res) => {
  const { difficulty, category } = req.params;
  try {
    await pool.query('DELETE FROM leaderboard WHERE difficulty = ? AND category = ?', [difficulty, category]);
    res.status(200).json({ message: `All scores for ${difficulty}-${category} deleted successfully` });
  } catch (err) {
    console.error(`Error deleting scores for ${difficulty}-${category}:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin Routes
router.get('/admin/feedback', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT username, feedback, created_at FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/unique-users', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(DISTINCT username) AS unique_users FROM leaderboard');
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving unique users:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/scores', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT username, score, difficulty, category, created_at FROM leaderboard ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving scores:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Feedback Route
router.post('/feedback', async (req, res) => {
  const { username, feedback } = req.body;

  // Validate input
  if (!username || !feedback) {
    console.error('Invalid input: username and feedback are required');
    return res.status(400).json({ message: 'Invalid input: username and feedback are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO feedback (username, feedback, created_at) VALUES (?, ?, ?)',
      [username, feedback, new Date()]
    );
    
    // Fetch the newly inserted feedback
    const [newFeedback] = await pool.query('SELECT * FROM feedback WHERE id = ?', [result.insertId]);
    res.json(newFeedback[0]);
  } catch (err) {
    console.error('Error saving feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Use the router for the API routes
app.use('/leaderboard', router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});