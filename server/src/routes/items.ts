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
  db.prepare('UPDATE income_sources SET name = COALESCE(?, name), amount = COALESCE(?, amount) WHERE id = ?')
    .run(name ?? null, amount ?? null, req.params.id);

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
  db.prepare(
    'UPDATE budget_items SET name = COALESCE(?, name), planned = COALESCE(?, planned), actual = COALESCE(?, actual) WHERE id = ?'
  ).run(name ?? null, planned ?? null, actual ?? null, req.params.id);

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

export default router;
