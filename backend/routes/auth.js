const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/db');

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const result = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, business_id: admin.business_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /auth/create-admin — run this once to create your first admin
// Remove or protect this route after initial setup!
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, name, role, business_id } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO admins (email, password_hash, name, role, business_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
      [email, hash, name || 'Admin', role || 'admin', business_id || null]
    );

    res.json({ success: true, admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});




module.exports = router;
