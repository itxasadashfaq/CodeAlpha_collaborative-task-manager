const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const auth = require('../middleware/auth');

// @route   GET api/notifications
// @desc    Get user's notifications
router.get('/', auth, async (req, res) => {
  const userId = req.user.user.id;
  try {
    const notifications = await dbQuery.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// @route   PUT api/notifications/read-all
// @desc    Mark all user's notifications as read
router.put('/read-all', auth, async (req, res) => {
  const userId = req.user.user.id;
  try {
    await dbQuery.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

module.exports = router;
