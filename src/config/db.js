const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('savingAppDB.js', (err) => {
  if (err) {
    console.error('Error opening database file:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS spendings (id INTEGER PRIMARY KEY, userId INTEGER, description TEXT, amount REAL)');
});

module.exports = db;
