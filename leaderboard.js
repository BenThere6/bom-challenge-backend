const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const router = express.Router();

// Create a new pool using the JAWSDB_URL environment variable
const pool = mysql.createPool(process.env.JAWSDB_URL);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// Get top 10 scores
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT username, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 10');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving leaderboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save a new score
router.post('/', async (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    console.error('Invalid input: username and score are required');
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO leaderboard (username, score, created_at) VALUES (?, ?, ?)',
      [username, score, new Date()]
    );
    const [newScore] = await pool.query('SELECT * FROM leaderboard WHERE id = ?', [result.insertId]);
    res.json(newScore[0]);
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete all scores
router.delete('/deletealllehilegacyscoresplease', async (req, res) => {
  try {
    await pool.query('DELETE FROM leaderboard');
    res.status(200).json({ message: 'All scores deleted successfully' });
  } catch (err) {
    console.error('Error deleting scores:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Use the router for the API routes
app.use('/leaderboard', router);

// Export the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});