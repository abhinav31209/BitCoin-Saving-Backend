const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'gulluthedon'; 
const authenticate = require('./middlewares/authMiddleware'); 

app.use(bodyParser.json());
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if the username already exists
    const checkUsername = db.prepare('SELECT * FROM users WHERE username = ?');
    const existingUser = await new Promise((resolve, reject) => {
      checkUsername.get(username, (err, row) => (err ? reject(err) : resolve(row)));
    });
    checkUsername.finalize();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const insertUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const { lastID } = insertUser.run(username, hashedPassword);
    insertUser.finalize();

    res.status(201).json({ userId: lastID, message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Retrieve user from the database
    const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = await new Promise((resolve, reject) => {
      getUser.get(username, (err, row) => (err ? reject(err) : resolve(row)));
    });
    getUser.finalize();

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY);

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/addExpense', authenticate, (req, res) => {
  try {
    const { description, amount } = req.body;

    // Insert spending into the database
    const insertSpending = db.prepare('INSERT INTO spendings (userId, description, amount) VALUES (?, ?, ?)');
    insertSpending.run(req.user.userId, description, amount);
    insertSpending.finalize();

    res.status(201).json({ message: 'Spending added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getExpenses', authenticate, (req, res) => {
  try {
    // Retrieve all spendings for the logged-in user
    const getSpendings = db.prepare('SELECT * FROM spendings WHERE userId = ?');
    const spendings = [];
    getSpendings.each(req.user.userId, (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      spendings.push(row);
    }, () => {
      getSpendings.finalize();
      res.json({ spendings });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.delete('/removeExpense/:spendingId', authenticate, (req, res) => {
  try {
    const spendingId = req.params.spendingId;

    // Check if the spending exists and belongs to the logged-in user
    const checkSpending = db.prepare('SELECT * FROM spendings WHERE id = ? AND userId = ?');
    checkSpending.get(spendingId, req.user.userId, (err, spending) => {
      checkSpending.finalize();

      if (!spending) {
        return res.status(404).json({ error: 'Spending not found or does not belong to the user' });
      }

      // Delete the spending from the database
      const deleteSpending = db.prepare('DELETE FROM spendings WHERE id = ?');
      deleteSpending.run(spendingId, (err) => {
        deleteSpending.finalize();

        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.json({ message: 'Spending deleted successfully' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update the amount of a specific spending
app.put('/updateExpense/:spendingId', authenticate, (req, res) => {
  try {
    const spendingId = req.params.spendingId;
    const { amount } = req.body;

    // Check if the spending exists and belongs to the logged-in user
    const checkSpending = db.prepare('SELECT * FROM spendings WHERE id = ? AND userId = ?');
    checkSpending.get(spendingId, req.user.userId, (err, spending) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!spending) {
        checkSpending.finalize();
        return res.status(404).json({ error: 'Spending not found or does not belong to the user' });
      }

      // Update the amount of the spending in the database
      const updateAmount = db.prepare('UPDATE spendings SET amount = ? WHERE id = ?');
      updateAmount.run(amount, spendingId, (err) => {
        checkSpending.finalize();
        updateAmount.finalize();

        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.json({ message: 'Spending amount updated successfully' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

