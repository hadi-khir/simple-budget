import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const DEFAULT_ITEMS: { category: 'fundamentals' | 'fun' | 'future'; name: string }[] = [
  // Fundamentals (50%)
  { category: 'fundamentals', name: 'Rent' },
  { category: 'fundamentals', name: 'Transportation' },
  { category: 'fundamentals', name: 'Groceries' },
  { category: 'fundamentals', name: 'Internet' },
  { category: 'fundamentals', name: 'Hydro' },
  { category: 'fundamentals', name: 'Gas' },
  { category: 'fundamentals', name: 'Cell Phone' },
  { category: 'fundamentals', name: 'Gym' },
  // Fun (30%)
  { category: 'fun', name: 'Clothing' },
  { category: 'fun', name: 'Drinks' },
  { category: 'fun', name: 'Eating out' },
  { category: 'fun', name: 'Adventures' },
  { category: 'fun', name: 'Coffee' },
  { category: 'fun', name: 'Miscellaneous' },
  // Future You (20%)
  { category: 'future', name: 'Emergency fund' },
  { category: 'future', name: 'Extra debt payments' },
  { category: 'future', name: 'Self-development' },
  { category: 'future', name: 'Education' },
  { category: 'future', name: 'Vacation fund' },
  { category: 'future', name: 'Pension' },
];

router.get('/', (req: AuthRequest, res: Response): void => {
  const budgets = db.prepare(
    'SELECT * FROM budgets WHERE user_id = ? ORDER BY year DESC, month DESC'
  ).all(req.userId);
  res.json(budgets);
});

router.post('/', (req: AuthRequest, res: Response): void => {
  const { month, year } = req.body;
  if (!month || !year) {
    res.status(400).json({ error: 'month and year are required' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO budgets (user_id, month, year) VALUES (?, ?, ?)'
    ).run(req.userId, month, year);

    const budgetId = result.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT INTO budget_items (budget_id, category, name, planned, actual, sort_order) VALUES (?, ?, ?, 0, 0, ?)'
    );
    const insertMany = db.transaction((items: typeof DEFAULT_ITEMS) => {
      items.forEach((item, i) => insertItem.run(budgetId, item.category, item.name, i));
    });
    insertMany(DEFAULT_ITEMS);

    res.status(201).json({ id: budgetId, user_id: req.userId, month, year });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Budget for this month already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create budget' });
    }
  }
});

router.get('/:id', (req: AuthRequest, res: Response): void => {
  const budget = db.prepare(
    'SELECT * FROM budgets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId) as any;

  if (!budget) {
    res.status(404).json({ error: 'Budget not found' });
    return;
  }

  const income = db.prepare('SELECT * FROM income_sources WHERE budget_id = ?').all(budget.id);
  const items = db.prepare(
    'SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order ASC'
  ).all(budget.id);

  res.json({ ...budget, income, items });
});

router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const budget = db.prepare(
    'SELECT id FROM budgets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!budget) {
    res.status(404).json({ error: 'Budget not found' });
    return;
  }

  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Income routes nested under budget
router.post('/:id/income', (req: AuthRequest, res: Response): void => {
  const budget = db.prepare(
    'SELECT id FROM budgets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!budget) {
    res.status(404).json({ error: 'Budget not found' });
    return;
  }

  const { name, amount } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO income_sources (budget_id, name, amount) VALUES (?, ?, ?)'
  ).run(req.params.id, name, amount || 0);

  res.status(201).json({ id: result.lastInsertRowid, budget_id: Number(req.params.id), name, amount: amount || 0 });
});

// Items nested under budget
router.post('/:id/items', (req: AuthRequest, res: Response): void => {
  const budget = db.prepare(
    'SELECT id FROM budgets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!budget) {
    res.status(404).json({ error: 'Budget not found' });
    return;
  }

  const { category, name, planned, actual } = req.body;
  if (!category || !name) {
    res.status(400).json({ error: 'category and name are required' });
    return;
  }

  const maxOrder = db.prepare(
    'SELECT MAX(sort_order) as max FROM budget_items WHERE budget_id = ? AND category = ?'
  ).get(req.params.id, category) as any;

  const sort_order = (maxOrder?.max ?? -1) + 1;

  const result = db.prepare(
    'INSERT INTO budget_items (budget_id, category, name, planned, actual, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, category, name, planned || 0, actual || 0, sort_order);

  res.status(201).json({
    id: result.lastInsertRowid,
    budget_id: Number(req.params.id),
    category,
    name,
    planned: planned || 0,
    actual: actual || 0,
    sort_order,
  });
});

export default router;
