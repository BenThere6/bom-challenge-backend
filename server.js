// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5005;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Routes
const leaderboardRoutes = require('./routes/leaderboard');
app.use('/leaderboard', leaderboardRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});