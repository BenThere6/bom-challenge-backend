const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { cosineSimilarity } = require('../utils/utils');

// Load preprocessed data
let versesData = [];

fs.createReadStream(path.join(__dirname, '../data/preprocessed_verses.csv'))
  .pipe(csv())
  .on('data', (row) => {
    row.embedding = JSON.parse(row.embedding); // Parse the embedding back to an array
    versesData.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
  });

// Function to find similar verses
const findSimilarVerses = (embedding, topN = 3) => {
  const similarities = versesData.map((verse) => {
    return {
      reference: verse.reference,
      verse: verse.verse,
      similarity: cosineSimilarity(embedding, verse.embedding),
    };
  });

  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(1, topN + 1); // Skip the first one as it's the same verse
};

// Endpoint to get multiple choice options
router.post('/get-multiple-choice', (req, res) => {
  const { verseReference } = req.body;

  const verseData = versesData.find(v => v.reference === verseReference);
  if (!verseData) {
    return res.status(404).json({ message: 'Verse not found' });
  }

  const similarVerses = findSimilarVerses(verseData.embedding);
  const options = [verseData, ...similarVerses].map(v => ({ reference: v.reference, verse: v.verse }));

  res.json({ options });
});

module.exports = router;