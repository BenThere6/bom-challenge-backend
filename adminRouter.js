// adminRouter.js
const express = require('express');
const router = express.Router();
const { pool, authenticateAdmin } = require('./helpers'); // Assuming these are exported from your main server file

// Admin routes
router.get('/feedback', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/feedback');
  try {
    const [rows] = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving feedback:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a specific feedback
router.delete('/feedback/:id', authenticateAdmin, async (req, res) => {
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
  router.delete('/scores/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM leaderboard WHERE id = ?', [id]);
      res.status(200).json({ message: 'Score deleted successfully' });
    } catch (err) {
      console.error('Error deleting score:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

router.get('/unique-users', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/unique-users');
  try {
    const [rows] = await pool.query('SELECT COUNT(DISTINCT username) AS unique_users FROM users');
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving unique users:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/scores', authenticateAdmin, async (req, res) => {
  console.log('GET request for /admin/scores');
  try {
    const [rows] = await pool.query('SELECT * FROM leaderboard ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving scores:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;