require('dotenv').config();
const pool = require('./db/pool');

async function setAdmin(email) {
  const result = await pool.query(
    `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    console.log(`No user found with email: ${email}`);
  } else {
    console.log(`Updated:`, result.rows[0]);
  }

  await pool.end();
}

setAdmin('testing@gmail.com');
