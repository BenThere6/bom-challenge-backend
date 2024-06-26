const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const router = express.Router();

// Database setup
const dbPath = path.join(__dirname, 'leaderboard.db');
const db = new sqlite3.Database(dbPath);

// Create leaderboard table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
});

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
  db.all('SELECT username, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error retrieving leaderboard:', err);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }
    res.json(rows);
  });
});

// Save a new score
router.post('/', (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    console.error('Invalid input: username and score are required');
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  const createdAt = new Date().toISOString();
  const query = 'INSERT INTO leaderboard (username, score, created_at) VALUES (?, ?, ?)';
  db.run(query, [username, score, createdAt], function(err) {
    if (err) {
      console.error('Error saving score:', err);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }

    db.all('SELECT username, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 10', (err, rows) => {
      if (err) {
        console.error('Error retrieving leaderboard:', err);
        res.status(500).json({ message: 'Internal server error' });
        return;
      }
      res.json(rows);
    });
  });
});

// Use the router for the API routes
app.use('/api/leaderboard', router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});