const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const registerAdmin = async () => {
  const username = 'admin'; // Set your desired admin username
  const password = process.env.ADMIN_PASS; // Set your desired admin password
  const role = 'admin';

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [rows] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    console.log('Admin registered successfully');
  } catch (err) {
    console.error('Error registering admin:', err);
  } finally {
    await pool.end();
  }
};

registerAdmin();