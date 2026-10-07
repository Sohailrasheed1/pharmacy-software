import { Router } from 'express';
import { db } from '../config/database.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username aur password dono zaroori hain.' });
    }

    const user = db.prepare(`
      SELECT id, username, password_hash, role, name 
      FROM users 
      WHERE LOWER(username) = LOWER(?)
    `).get(username.trim()) as any;

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Ghalat username ya password! Baraye meherbani dobara check karein.' });
    }

    // Return authenticated user profile
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role, // 'Owner' or 'Cashier'
        name: user.name
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
