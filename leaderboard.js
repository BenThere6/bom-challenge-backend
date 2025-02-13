const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const leaderboardRouter = express.Router();
const adminRouter = express.Router();
const feedbackRouter = express.Router();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmailNotification = (username, score, difficulty, category) => {
  console.log('Preparing to send email notification for new score:', { username, score, difficulty, category });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'benbirdsall7@gmail.com',
    subject: 'New Score Posted',
    text: `Username: ${username}\nScore: ${score}\nDifficulty: ${difficulty}\nCategory: ${category}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      console.log('Here are the creds we have on file: ' + process.env.EMAIL_PASS, process.env.EMAIL_USER, process.env.DB_HOST);
    } else {
      console.log('Email sent successfully:', info.response);
    }
  });
};

const sendFeedbackEmailNotification = (username, feedback) => {
  console.log('Preparing to send email notification for new feedback:', { username, feedback });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'benbirdsall7@gmail.com',
    subject: 'New Feedback Received',
    text: `Username: ${username}\nFeedback: ${feedback}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending feedback email:', error);
    } else {
      console.log('Feedback email sent successfully:', info.response);
    }
  });
};

leaderboardRouter.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

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

leaderboardRouter.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body; // Add rememberMe to the request body

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

    // Set token expiration based on the rememberMe flag
    const expiresIn = rememberMe ? '30d' : '1h'; // 30 days if rememberMe is true, otherwise 1 hour

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn });
    res.json({ token });
  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
    console.log('Unique usernames in leaderboard query result:', rows);
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

leaderboardRouter.get('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  console.log(`GET request for leaderboard with difficulty: ${difficulty} and category: ${category}`);
  try {
    const [rows] = await pool.query(
      'SELECT username, score, created_at FROM leaderboard WHERE difficulty = ? AND category = ? ORDER BY score DESC LIMIT 100', 
      [difficulty, category]
    );
    res.json(rows);
  } catch (err) {
    console.error(`Error retrieving ${difficulty}-${category} leaderboard:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

leaderboardRouter.post('/special-message-seen', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'benbirdsall7@gmail.com', // your email
    subject: 'Special Message Seen',
    text: `The special message was seen by: ${username}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Special message seen email sent successfully');
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending special message seen email:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

leaderboardRouter.post('/:difficulty/:category', async (req, res) => {
  const { difficulty, category } = req.params;
  const { username, score } = req.body;

  if (!username || typeof score !== 'number') {
    console.error('Invalid input: username and score are required');
    return res.status(400).json({ message: 'Invalid input: username and score are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO leaderboard (username, score, difficulty, category, created_at) VALUES (?, ?, ?, ?, ?)',
      [username, score, difficulty, category, new Date()]
    );

    const [newScore] = await pool.query('SELECT * FROM leaderboard WHERE id = ?', [result.insertId]);
    res.json(newScore[0]);

    console.log('Score saved successfully:', { username, score, difficulty, category });

    sendEmailNotification(username, score, difficulty, category);
  } catch (err) {
    console.error(`Error saving score for ${difficulty}-${category}:, err`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

    sendFeedbackEmailNotification(username, feedback);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use('/leaderboard', leaderboardRouter);
app.use('/admin', adminRouter);
app.use('/feedback', feedbackRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});