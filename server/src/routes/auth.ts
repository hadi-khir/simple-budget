import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db';
import { authMiddleware, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use('/login', authLimiter);
router.use('/signup', authLimiter);

router.post('/signup', (req: Request, res: Response): void => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).run(email.toLowerCase().trim(), password_hash, name.trim());

  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id: result.lastInsertRowid, email, name } });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

export default router;
