import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

function getBudgetIdForItem(itemId: string | number): number | null {
  const item = db.prepare('SELECT budget_id FROM budget_items WHERE id = ?').get(itemId) as any;
  return item?.budget_id ?? null;
}

function getBudgetIdForIncome(incomeId: string | number): number | null {
  const income = db.prepare('SELECT budget_id FROM income_sources WHERE id = ?').get(incomeId) as any;
  return income?.budget_id ?? null;
}

function userOwnsBudget(userId: number, budgetId: number): boolean {
  const budget = db.prepare('SELECT id FROM budgets WHERE id = ? AND user_id = ?').get(budgetId, userId);
  return !!budget;
}

// Income CRUD
router.put('/income/:id', (req: AuthRequest, res: Response): void => {
  const budgetId = getBudgetIdForIncome(req.params.id);
  if (!budgetId || !userOwnsBudget(req.userId!, budgetId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { name, amount } = req.body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100)) {
    res.status(400).json({ error: 'name must be between 1 and 100 characters' });
    return;
  }
  const parsedAmount = amount !== undefined ? parseFloat(amount) : undefined;
  if (parsedAmount !== undefined && (isNaN(parsedAmount) || parsedAmount < 0)) {
    res.status(400).json({ error: 'amount must be a non-negative number' });
    return;
  }
  db.prepare('UPDATE income_sources SET name = COALESCE(?, name), amount = COALESCE(?, amount) WHERE id = ?')
    .run(name?.trim() ?? null, parsedAmount ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/income/:id', (req: AuthRequest, res: Response): void => {
  const budgetId = getBudgetIdForIncome(req.params.id);
  if (!budgetId || !userOwnsBudget(req.userId!, budgetId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  db.prepare('DELETE FROM income_sources WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Budget items CRUD
router.put('/items/:id', (req: AuthRequest, res: Response): void => {
  const budgetId = getBudgetIdForItem(req.params.id);
  if (!budgetId || !userOwnsBudget(req.userId!, budgetId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { name, planned, actual } = req.body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100)) {
    res.status(400).json({ error: 'name must be between 1 and 100 characters' });
    return;
  }
  const parsedPlanned = planned !== undefined ? parseFloat(planned) : undefined;
  const parsedActual = actual !== undefined ? parseFloat(actual) : undefined;
  if (parsedPlanned !== undefined && (isNaN(parsedPlanned) || parsedPlanned < 0)) {
    res.status(400).json({ error: 'planned must be a non-negative number' });
    return;
  }
  if (parsedActual !== undefined && (isNaN(parsedActual) || parsedActual < 0)) {
    res.status(400).json({ error: 'actual must be a non-negative number' });
    return;
  }
  db.prepare(
    'UPDATE budget_items SET name = COALESCE(?, name), planned = COALESCE(?, planned), actual = COALESCE(?, actual) WHERE id = ?'
  ).run(name?.trim() ?? null, parsedPlanned ?? null, parsedActual ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/items/:id', (req: AuthRequest, res: Response): void => {
  const budgetId = getBudgetIdForItem(req.params.id);
  if (!budgetId || !userOwnsBudget(req.userId!, budgetId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  db.prepare('DELETE FROM budget_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Transactions
router.post('/items/:id/transactions', (req: AuthRequest, res: Response): void => {
  const budgetId = getBudgetIdForItem(req.params.id);
  if (!budgetId || !userOwnsBudget(req.userId!, budgetId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }

  const result = (db.transaction(() => {
    const txResult = db.prepare(
      'INSERT INTO transactions (budget_item_id, amount) VALUES (?, ?)'
    ).run(req.params.id, amount);
    db.prepare('UPDATE budget_items SET actual = actual + ? WHERE id = ?').run(amount, req.params.id);
    const transaction = db.prepare(
      `SELECT t.id, t.budget_item_id, t.amount, t.created_at,
              bi.name as item_name, bi.category
       FROM transactions t JOIN budget_items bi ON t.budget_item_id = bi.id
       WHERE t.id = ?`
    ).get(txResult.lastInsertRowid);
    const item = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
    return { transaction, item };
  }))();

  res.status(201).json(result);
});

router.delete('/transactions/:id', (req: AuthRequest, res: Response): void => {
  const tx = db.prepare(
    `SELECT t.*, bi.budget_id FROM transactions t
     JOIN budget_items bi ON t.budget_item_id = bi.id
     JOIN budgets b ON bi.budget_id = b.id
     WHERE t.id = ? AND b.user_id = ?`
  ).get(req.params.id, req.userId!) as any;

  if (!tx) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const item = (db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE budget_items SET actual = MAX(0, actual - ?) WHERE id = ?')
      .run(tx.amount, tx.budget_item_id);
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(tx.budget_item_id);
  }))();

  res.json({ item });
});

export default router;
