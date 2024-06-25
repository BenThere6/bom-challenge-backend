import React, { useState, useEffect } from 'react';
import '../Leaderboard.css';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

function Leaderboard({ score, onStartScreen }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    fetch('https://your-site.netlify.app/.netlify/functions/leaderboard')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setLeaderboard(data);
        findUserRank(data);
      })
      .catch((error) => console.error('Error fetching leaderboard:', error));
  }, []);

  const findUserRank = (data) => {
    const sortedLeaderboard = [...data].sort((a, b) => b.score - a.score);
    const userIndex = sortedLeaderboard.findIndex((entry) => entry.username === username && entry.score === score);
    setUserRank(userIndex !== -1 ? userIndex + 1 : null);
  };

  const handleSaveScore = (event) => {
    event.preventDefault(); // Prevent form submission

    if (!username) {
      console.error('Username is required');
      return;
    }

    fetch('https://your-site.netlify.app/.netlify/functions/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setLeaderboard(data);
        setIsSubmitted(true); // Set isSubmitted to true after successful submission
        findUserRank(data); // Update user's rank after leaderboard update
      })
      .catch((error) => console.error('Error saving score:', error));
  };

  const handlePlayAgain = () => {
    setUsername('');
    setIsSubmitted(false);
    onStartScreen(); // Callback to switch to the start screen component
  };

  const isUserInTopTen = (index) => {
    return userRank !== null && index === userRank - 1;
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard">
        <h2>Your Current Score: {score}</h2>
        <h2>Leaderboard</h2>
        <ol>
          {leaderboard.map((entry, index) => (
            <li key={index} className={isUserInTopTen(index) ? 'highlighted' : ''}>
              <span className="rank">{index + 1}.</span>
              <span className="username">{entry.username}</span>
              <span className="score">{entry.score}</span>
            </li>
          ))}
        </ol>
        {isSubmitted ? (
          <div className="play-again">
            <Button variant="contained" onClick={handlePlayAgain}>Play Again</Button>
          </div>
        ) : (
          <form onSubmit={handleSaveScore}>
            <TextField
              label="Username"
              variant="outlined"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              fullWidth
            />
            <div className="button-container">
              <Button variant="contained" type="submit">Submit Score</Button>
              <Button variant="contained" onClick={handlePlayAgain}>Play Again</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;