const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const leaderboardRouter = express.Router();
const adminRouter = express.Router();
const feedbackRouter = express.Router();

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
app.use(cookieParser());

// Manually set CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// Middleware to track unique visitors and retention
app.use(async (req, res, next) => {
  const token = req.cookies.user_token;

  if (!token) {
    // Generate a new token and set it in cookies
    const newToken = jwt.sign({ timestamp: Date.now() }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('user_token', newToken, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

    // Save new user to the database
    await pool.query(
      'INSERT INTO users (token, created_at) VALUES (?, ?)',
      [newToken, new Date()]
    );

    req.newVisitor = true;
  } else {
    const [user] = await pool.query('SELECT * FROM users WHERE token = ?', [token]);
    if (!user[0]) {
      // Handle invalid or expired token
      res.clearCookie('user_token');
      return next();
    }
    req.user = user[0];
    req.newVisitor = false;
  }

  next();
});

// Export pool and authenticateAdmin for reuse in other modules
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

// User registration
leaderboardRouter.post('/register', async (req, res) => {
  const { username, password, role } = req.body; // Add role to request body

  if (!username || !password || !role) {
    console.log('Invalid registration input:', req.body);
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User login
leaderboardRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    console.log('Invalid login input:', req.body);
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('Invalid username or password for user:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin routes
adminRouter.get('/feedback', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/feedback');
  try {
    const [rows] = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

adminRouter.get('/unique-users', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/unique-users');
  try {
    const [rows] = await pool.query('SELECT COUNT(DISTINCT username) AS unique_users FROM leaderboard');
    console.log('Unique usernames in leaderboard query result:', rows); // Add this line to check the result
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving unique usernames in leaderboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

adminRouter.get('/scores', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/scores');
  try {
    const [rows] = await pool.query('SELECT * FROM leaderboard ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving scores:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a specific feedback
adminRouter.delete('/feedback/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM feedback WHERE id = ?', [id]);
    res.status(200).json({ message: 'Feedback deleted successfully' });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a specific score
adminRouter.delete('/scores/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM leaderboard WHERE id = ?', [id]);
    res.status(200).json({ message: 'Score deleted successfully' });
  } catch (err) {
    console.error('Error deleting score:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Leaderboard routes
leaderboardRouter.get('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  console.log(`GET request for leaderboard with difficulty: ${difficulty} and category: ${category}`);
  try {
    const [rows] = await pool.query('SELECT username, score, created_at FROM leaderboard WHERE difficulty = ? AND category = ? ORDER BY score DESC LIMIT 10', [difficulty, category]);
    res.json(rows);
  } catch (err) {
    console.error(`Error retrieving ${difficulty}-${category} leaderboard:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save a new score for a specific difficulty and category
leaderboardRouter.post('/:difficulty/:category', async (req, res) => {
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
leaderboardRouter.delete('/:difficulty/:category/deleteall', async (req, res) => {
  const { difficulty, category } = req.params;
  try {
    await pool.query('DELETE FROM leaderboard WHERE difficulty = ? AND category = ?', [difficulty, category]);
    res.status(200).json({ message: `All scores for ${difficulty}-${category} deleted successfully` });
  } catch (err) {
    console.error(`Error deleting scores for ${difficulty}-${category}:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST feedback
feedbackRouter.post('/', async (req, res) => {
  const { username, feedback } = req.body;

  if (!username || !feedback) {
    console.log('Invalid feedback input:', req.body);
    return res.status(400).json({ message: 'Username and feedback are required' });
  }

  try {
    await pool.query(
      'INSERT INTO feedback (username, feedback, created_at) VALUES (?, ?, ?)',
      [username, feedback, new Date()]
    );

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Retention Rate route
adminRouter.get('/retention-rate', authenticateAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT COUNT(id) as total_users FROM users');
    const [returningUsers] = await pool.query('SELECT COUNT(DISTINCT token) as returning_users FROM users WHERE DATE_SUB(NOW(), INTERVAL 30 DAY) <= created_at');

    const totalUsers = users[0].total_users;
    const returningUsersCount = returningUsers[0].returning_users;

    const retentionRate = (returningUsersCount / totalUsers) * 100;

    res.json({ retentionRate: retentionRate.toFixed(2) });
  } catch (err) {
    console.error('Error calculating retention rate:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Use the routers for the API routes
app.use('/leaderboard', leaderboardRouter);
app.use('/admin', adminRouter);
app.use('/feedback', feedbackRouter);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});