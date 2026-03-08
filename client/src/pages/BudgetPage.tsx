import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, BudgetDetail, IncomeSource, BudgetItem } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Logo from '../components/Logo';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Category = 'fundamentals' | 'fun' | 'future';

const CATEGORIES: { key: Category; label: string; target: number; color: string; bg: string; ring: string }[] = [
  { key: 'fundamentals', label: 'Fundamentals', target: 50, color: 'text-blue-700', bg: 'bg-blue-50', ring: 'stroke-blue-500' },
  { key: 'fun', label: 'Fun', target: 30, color: 'text-purple-700', bg: 'bg-purple-50', ring: 'stroke-purple-500' },
  { key: 'future', label: 'Future You', target: 20, color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'stroke-emerald-500' },
];

function fmt(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

function ProgressRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        className={color}
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New income form
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [addingIncome, setAddingIncome] = useState(false);

  // New item forms per category
  const [newItemName, setNewItemName] = useState<Record<Category, string>>({ fundamentals: '', fun: '', future: '' });
  const [addingItem, setAddingItem] = useState<Record<Category, boolean>>({ fundamentals: false, fun: false, future: false });

  useEffect(() => {
    api.budgets.get(Number(id))
      .then(setBudget)
      .catch(() => setError('Budget not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const totalIncome = budget?.income.reduce((s, i) => s + i.amount, 0) ?? 0;

  const categoryTotals = useCallback((cat: Category) => {
    const items = budget?.items.filter(i => i.category === cat) ?? [];
    return {
      planned: items.reduce((s, i) => s + i.planned, 0),
      actual: items.reduce((s, i) => s + i.actual, 0),
    };
  }, [budget]);

  const totalPlanned = CATEGORIES.reduce((s, c) => s + categoryTotals(c.key).planned, 0);
  const totalActual = CATEGORIES.reduce((s, c) => s + categoryTotals(c.key).actual, 0);

  async function addIncome() {
    if (!newIncomeName.trim() || !budget) return;
    setAddingIncome(true);
    try {
      const income = await api.budgets.addIncome(budget.id, {
        name: newIncomeName.trim(),
        amount: parseFloat(newIncomeAmount) || 0,
      });
      setBudget(b => b ? { ...b, income: [...b.income, income] } : b);
      setNewIncomeName('');
      setNewIncomeAmount('');
    } finally {
      setAddingIncome(false);
    }
  }

  async function updateIncome(incomeId: number, data: { name?: string; amount?: number }) {
    const updated = await api.income.update(incomeId, data);
    setBudget(b => b ? { ...b, income: b.income.map(i => i.id === incomeId ? updated : i) } : b);
  }

  async function deleteIncome(incomeId: number) {
    await api.income.delete(incomeId);
    setBudget(b => b ? { ...b, income: b.income.filter(i => i.id !== incomeId) } : b);
  }

  async function addItem(cat: Category) {
    const name = newItemName[cat].trim();
    if (!name || !budget) return;
    setAddingItem(prev => ({ ...prev, [cat]: true }));
    try {
      const item = await api.budgets.addItem(budget.id, { category: cat, name });
      setBudget(b => b ? { ...b, items: [...b.items, item] } : b);
      setNewItemName(prev => ({ ...prev, [cat]: '' }));
    } finally {
      setAddingItem(prev => ({ ...prev, [cat]: false }));
    }
  }

  async function updateItem(itemId: number, data: { name?: string; planned?: number; actual?: number }) {
    const updated = await api.items.update(itemId, data);
    setBudget(b => b ? { ...b, items: b.items.map(i => i.id === itemId ? updated : i) } : b);
  }

  async function deleteItem(itemId: number) {
    await api.items.delete(itemId);
    setBudget(b => b ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (error || !budget) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-destructive">{error || 'Budget not found'}</p>
      <Button onClick={() => navigate('/')}>Go back</Button>
    </div>
  );

  const leftoverPlanned = totalIncome - totalPlanned;
  const leftoverActual = totalIncome - totalActual;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </Button>
          <Logo size={26} />
          <h1 className="text-lg font-bold text-indigo-700">
            {MONTHS[budget.month - 1]} {budget.year}
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Income Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Income</span>
              <span className="text-2xl font-bold text-emerald-600">{fmt(totalIncome)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {budget.income.map(inc => (
              <IncomeRow
                key={inc.id}
                income={inc}
                onUpdate={data => updateIncome(inc.id, data)}
                onDelete={() => deleteIncome(inc.id)}
              />
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Source name"
                value={newIncomeName}
                onChange={e => setNewIncomeName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && addIncome()}
              />
              <Input
                type="number"
                placeholder="Amount"
                value={newIncomeAmount}
                onChange={e => setNewIncomeAmount(e.target.value)}
                className="h-8 text-sm w-32 text-right"
                onKeyDown={e => e.key === 'Enter' && addIncome()}
              />
              <Button size="sm" onClick={addIncome} disabled={addingIncome || !newIncomeName.trim()} className="gap-1 whitespace-nowrap">
                <Plus size={14} /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Category Panels */}
        <div className="grid gap-4 lg:grid-cols-3">
          {CATEGORIES.map(cat => {
            const items = budget.items.filter(i => i.category === cat.key);
            const totals = categoryTotals(cat.key);
            const plannedPct = totalIncome > 0 ? (totals.planned / totalIncome) * 100 : 0;
            const actualPct = totalIncome > 0 ? (totals.actual / totalIncome) * 100 : 0;

            return (
              <Card key={cat.key} className={`border-t-4 ${cat.key === 'fundamentals' ? 'border-t-blue-500' : cat.key === 'fun' ? 'border-t-purple-500' : 'border-t-emerald-500'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className={`text-base ${cat.color}`}>{cat.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">Target: {cat.target}% of income</p>
                    </div>
                    <div className="relative flex items-center justify-center" style={{ width: 70, height: 70 }}>
                      <ProgressRing pct={actualPct} color={cat.ring} size={70} />
                      <span className="absolute text-xs font-bold">{Math.round(actualPct)}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                    <div>
                      <span className="text-muted-foreground text-xs">Planned</span>
                      <p className="font-semibold">{fmt(totals.planned)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-xs">Actual</span>
                      <p className={`font-semibold ${totals.actual > totals.planned && totals.planned > 0 ? 'text-destructive' : ''}`}>
                        {fmt(totals.actual)}
                      </p>
                    </div>
                  </div>
                  {/* Target % bar */}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Planned {plannedPct.toFixed(0)}%</span>
                      <span>Target {cat.target}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cat.key === 'fundamentals' ? 'bg-blue-400' : cat.key === 'fun' ? 'bg-purple-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(plannedPct / cat.target * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  <div className="grid grid-cols-[1fr_80px_80px_28px] gap-1 text-xs text-muted-foreground px-1 mb-1">
                    <span>Item</span>
                    <span className="text-right">Planned</span>
                    <span className="text-right">Actual</span>
                    <span />
                  </div>
                  {items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onUpdate={data => updateItem(item.id, data)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                  <div className="flex gap-1 pt-1">
                    <Input
                      placeholder="New item"
                      value={newItemName[cat.key]}
                      onChange={e => setNewItemName(prev => ({ ...prev, [cat.key]: e.target.value }))}
                      className="h-7 text-xs"
                      onKeyDown={e => e.key === 'Enter' && addItem(cat.key)}
                    />
                    <Button
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => addItem(cat.key)}
                      disabled={addingItem[cat.key] || !newItemName[cat.key].trim()}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Bar */}
        <Card className="bg-gray-900 text-white border-0">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-xs">Total Income</p>
                <p className="text-xl font-bold text-emerald-400">{fmt(totalIncome)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Planned</p>
                <p className="text-xl font-bold">{fmt(totalPlanned)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Actual</p>
                <p className="text-xl font-bold">{fmt(totalActual)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Leftover (Planned / Actual)</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className={`text-xl font-bold ${leftoverPlanned >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(leftoverPlanned)}
                  </p>
                  <span className="text-gray-500 text-sm">/</span>
                  <p className={`text-xl font-bold ${leftoverActual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(leftoverActual)}
                  </p>
                </div>
              </div>
            </div>

            {/* Category breakdown bars */}
            {totalIncome > 0 && (
              <div className="mt-4 space-y-2">
                {CATEGORIES.map(cat => {
                  const totals = categoryTotals(cat.key);
                  const pct = (totals.actual / totalIncome) * 100;
                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 shrink-0">{cat.label}</span>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${cat.key === 'fundamentals' ? 'bg-blue-500' : cat.key === 'fun' ? 'bg-purple-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-24 text-right">
                        {pct.toFixed(0)}% / {cat.target}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function IncomeRow({
  income,
  onUpdate,
  onDelete,
}: {
  income: IncomeSource;
  onUpdate: (data: { name?: string; amount?: number }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(income.name);

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name !== income.name && onUpdate({ name })}
        className="h-8 text-sm"
      />
      <NumInput value={income.amount} onChange={amount => onUpdate({ amount })} className="h-8 text-sm w-32" />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

function ItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: BudgetItem;
  onUpdate: (data: { name?: string; planned?: number; actual?: number }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);

  return (
    <div className="grid grid-cols-[1fr_80px_80px_28px] gap-1 items-center">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name !== item.name && onUpdate({ name })}
        className="h-7 text-xs px-2"
      />
      <NumInput value={item.planned} onChange={planned => onUpdate({ planned })} />
      <NumInput value={item.actual} onChange={actual => onUpdate({ actual })} />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 size={12} />
      </Button>
    </div>
  );
}

function NumInput({ value, onChange, className = '' }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <Input
      type="number"
      min={0}
      step={0.01}
      value={local}
      className={cn('h-7 text-right text-xs px-1', className)}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseFloat(local) || 0;
        setLocal(String(n));
        if (n !== value) onChange(n);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
