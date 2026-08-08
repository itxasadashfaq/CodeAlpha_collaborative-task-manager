const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_fallback';

// @route   POST api/auth/register
// @desc    Register a user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check if user exists
    const userExists = await dbQuery.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with that username or email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const result = await dbQuery.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Generate JWT
    const payload = {
      user: {
        id: result.id,
        username,
        email
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: result.id, username, email } });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check for user
    const user = await dbQuery.get(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [emailOrUsername, emailOrUsername]
    );

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET api/auth/me
// @desc    Get logged in user details
router.get('/me', auth, async (req, res) => {
  try {
    const user = await dbQuery.get(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.user.id]
    );
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/auth/users
// @desc    Search users by name/email for inviting (requires authentication)
router.get('/users', auth, async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    // Search excluding the requesting user
    const users = await dbQuery.all(
      'SELECT id, username, email FROM users WHERE (username LIKE ? OR email LIKE ?) AND id != ? LIMIT 10',
      [`%${query}%`, `%${query}%`, req.user.user.id]
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error searching users' });
  }
});

module.exports = router;
