const axios = require('axios');
const bcrypt = require('bcrypt');
require('dotenv').config();

const registerAdmin = async () => {
  const username = 'admin';
  const password = process.env.ADMIN_PASS;
  const role = 'admin';

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const response = await axios.post(`https://bens-api-dd63362f50db.herokuapp.com/leaderboard/register`, {
      username,
      password: hashedPassword,
      role,
    });
    console.log('Admin registered successfully:', response.data);
  } catch (error) {
    console.error('Error registering admin:', error.response ? error.response.data : error.message);
  }
};

registerAdmin();