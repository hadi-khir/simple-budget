import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Budget, BudgetDetail } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PlusCircle, Trash2, LogOut, ArrowLeft, ArrowRight, Copy, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import Logo from '../components/Logo';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CATEGORIES = [
  { key: 'fundamentals' as const, label: 'Fundamentals', target: 50, color: 'text-blue-700', bar: 'bg-blue-500', bg: 'bg-blue-50' },
  { key: 'fun' as const, label: 'Fun', target: 30, color: 'text-purple-700', bar: 'bg-purple-500', bg: 'bg-purple-50' },
  { key: 'future' as const, label: 'Future You', target: 20, color: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50' },
];

const WIZARD_STEPS = [
  {
    key: 'fundamentals' as const,
    label: 'Fundamentals',
    target: 50,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    description: 'Essential expenses — housing, transportation, utilities',
    items: ['Rent', 'Transportation', 'Groceries', 'Internet', 'Hydro', 'Gas', 'Cell Phone', 'Gym'],
  },
  {
    key: 'fun' as const,
    label: 'Fun',
    target: 30,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    description: 'Discretionary spending — things you enjoy',
    items: ['Clothing', 'Drinks', 'Eating out', 'Adventures', 'Coffee', 'Miscellaneous'],
  },
  {
    key: 'future' as const,
    label: 'Future You',
    target: 20,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    description: 'Savings and investments for your future self',
    items: ['Emergency fund', 'Extra debt payments', 'Self-development', 'Education', 'Vacation fund', 'Pension'],
  },
];

type Category = 'fundamentals' | 'fun' | 'future';
type FormMode = null | 'select' | 'wizard';

function fmt(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardPlanned, setWizardPlanned] = useState<Record<string, number>>({});

  // Summary + quick add state
  const [currentMonthDetail, setCurrentMonthDetail] = useState<BudgetDetail | null>(null);
  const [qaDetail, setQaDetail] = useState<BudgetDetail | null>(null);
  const [qaCategory, setQaCategory] = useState<Category | ''>('');
  const [qaItemId, setQaItemId] = useState<number | ''>('');
  const [qaAmount, setQaAmount] = useState('');
  const [qaAdding, setQaAdding] = useState(false);
  const [qaSuccess, setQaSuccess] = useState(false);

  useEffect(() => {
    api.budgets.list().then(data => {
      setBudgets(data);
      const now = new Date();
      const cm = data.find(b => b.month === now.getMonth() + 1 && b.year === now.getFullYear());
      if (cm) {
        api.budgets.get(cm.id).then(detail => {
          setCurrentMonthDetail(detail);
          setQaDetail(detail);
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  // --- Budget creation ---

  function openForm() {
    setFormMode('select');
    setError('');
    setWizardStep(0);
    setWizardPlanned({});
  }

  function closeForm() {
    setFormMode(null);
    setError('');
  }

  function wizardKey(category: string, item: string) { return `${category}:${item}`; }

  async function quickCreate() {
    setSubmitting(true);
    setError('');
    try {
      const b = await api.budgets.create({ month: newMonth, year: newYear });
      setBudgets(prev => [b, ...prev]);
      closeForm();
      navigate(`/budgets/${b.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createFromWizard() {
    setSubmitting(true);
    setError('');
    try {
      const b = await api.budgets.create({ month: newMonth, year: newYear });
      const detail = await api.budgets.get(b.id);
      await Promise.all(
        detail.items
          .filter(item => (wizardPlanned[wizardKey(item.category, item.name)] ?? 0) > 0)
          .map(item => api.items.update(item.id, { planned: wizardPlanned[wizardKey(item.category, item.name)] }))
      );
      setBudgets(prev => [b, ...prev]);
      // If it's the current month, refresh the detail
      const now = new Date();
      if (b.month === now.getMonth() + 1 && b.year === now.getFullYear()) {
        const refreshed = await api.budgets.get(b.id);
        setCurrentMonthDetail(refreshed);
        setQaDetail(refreshed);
      }
      closeForm();
      navigate(`/budgets/${b.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPrevious() {
    setSubmitting(true);
    setError('');
    try {
      const targetOrd = newYear * 12 + newMonth;
      const prev = budgets
        .filter(b => b.year * 12 + b.month < targetOrd)
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0];
      if (!prev) { setError('No previous budget found to copy from.'); return; }

      const [prevDetail, newBudget] = await Promise.all([
        api.budgets.get(prev.id),
        api.budgets.create({ month: newMonth, year: newYear }),
      ]);
      const newDetail = await api.budgets.get(newBudget.id);

      const newItemKeys = new Set(newDetail.items.map(i => `${i.category}:${i.name}`));
      await Promise.all([
        ...newDetail.items.map(newItem => {
          const match = prevDetail.items.find(p => p.category === newItem.category && p.name === newItem.name);
          return match && match.planned > 0 ? api.items.update(newItem.id, { planned: match.planned }) : Promise.resolve();
        }),
        ...prevDetail.items
          .filter(p => !newItemKeys.has(`${p.category}:${p.name}`) && p.planned > 0)
          .map(p => api.budgets.addItem(newBudget.id, { category: p.category, name: p.name, planned: p.planned })),
        ...prevDetail.income.map(inc => api.budgets.addIncome(newBudget.id, { name: inc.name, amount: inc.amount })),
      ]);

      setBudgets(prev => [newBudget, ...prev]);
      const now = new Date();
      if (newBudget.month === now.getMonth() + 1 && newBudget.year === now.getFullYear()) {
        const refreshed = await api.budgets.get(newBudget.id);
        setCurrentMonthDetail(refreshed);
        setQaDetail(refreshed);
      }
      closeForm();
      navigate(`/budgets/${newBudget.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBudget(id: number) {
    if (!confirm('Delete this budget?')) return;
    await api.budgets.delete(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
    if (currentMonthDetail?.id === id) setCurrentMonthDetail(null);
    if (qaDetail?.id === id) setQaDetail(null);
  }

  // --- Quick add ---

  async function changeQaBudget(budgetId: number) {
    setQaCategory('');
    setQaItemId('');
    if (currentMonthDetail?.id === budgetId) {
      setQaDetail(currentMonthDetail);
      return;
    }
    const detail = await api.budgets.get(budgetId);
    setQaDetail(detail);
  }

  async function addTransaction() {
    if (!qaDetail || !qaItemId || !qaAmount || !qaCategory) return;
    const item = qaDetail.items.find(i => i.id === qaItemId);
    if (!item) return;
    const amount = parseFloat(qaAmount);
    if (isNaN(amount) || amount <= 0) return;

    setQaAdding(true);
    try {
      const updated = await api.items.update(Number(qaItemId), { actual: item.actual + amount });
      const patchItems = (items: typeof qaDetail.items) =>
        items.map(i => i.id === updated.id ? updated : i);
      setQaDetail(prev => prev ? { ...prev, items: patchItems(prev.items) } : prev);
      if (currentMonthDetail?.id === qaDetail.id) {
        setCurrentMonthDetail(prev => prev ? { ...prev, items: patchItems(prev.items) } : prev);
      }
      setQaAmount('');
      setQaItemId('');
      setQaSuccess(true);
      setTimeout(() => setQaSuccess(false), 2500);
    } finally {
      setQaAdding(false);
    }
  }

  // --- Derived values ---

  const totalIncome = currentMonthDetail?.income.reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalActual = currentMonthDetail?.items.reduce((s, i) => s + i.actual, 0) ?? 0;
  const remaining = totalIncome - totalActual;

  const qaItems = qaDetail?.items.filter(i => qaCategory && i.category === qaCategory) ?? [];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const currentStep = WIZARD_STEPS[wizardStep];
  const isLastStep = wizardStep === WIZARD_STEPS.length - 1;
  const stepTotal = currentStep
    ? currentStep.items.reduce((s, name) => s + (wizardPlanned[wizardKey(currentStep.key, name)] || 0), 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <h1 className="text-xl font-bold text-indigo-700">IST Budget</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hi, {user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut size={16} className="mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Monthly summary + quick add */}
        {currentMonthDetail && (
          <div className="grid md:grid-cols-5 gap-4">

            {/* Summary */}
            <Card className="md:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-indigo-700">
                  {MONTHS[currentMonthDetail.month - 1]} {currentMonthDetail.year}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Top stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="font-bold text-emerald-700 text-sm">{fmt(totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="font-bold text-red-600 text-sm">{fmt(totalActual)}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${remaining >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={`font-bold text-sm ${remaining >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                      {fmt(remaining)}
                    </p>
                  </div>
                </div>

                {/* Category bars */}
                <div className="space-y-2.5">
                  {CATEGORIES.map(cat => {
                    const items = currentMonthDetail.items.filter(i => i.category === cat.key);
                    const planned = items.reduce((s, i) => s + i.planned, 0);
                    const actual = items.reduce((s, i) => s + i.actual, 0);
                    const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
                    const over = actual > planned && planned > 0;
                    return (
                      <div key={cat.key}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {fmt(actual)} <span className="text-gray-400">/</span> {fmt(planned)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : cat.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-xs"
                  onClick={() => navigate(`/budgets/${currentMonthDetail.id}`)}
                >
                  View full budget →
                </Button>
              </CardContent>
            </Card>

            {/* Quick add */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Quick Add</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Budget selector */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">Budget</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={qaDetail?.id ?? ''}
                    onChange={e => changeQaBudget(Number(e.target.value))}
                  >
                    {budgets.map(b => (
                      <option key={b.id} value={b.id}>
                        {MONTHS[b.month - 1]} {b.year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category selector */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">Category</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => { setQaCategory(cat.key); setQaItemId(''); }}
                        className={`py-1.5 px-1 rounded-md text-xs font-medium border-2 transition-colors ${
                          qaCategory === cat.key
                            ? `${cat.bg} ${cat.color} border-current`
                            : 'bg-background border-transparent hover:bg-muted'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Item selector */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">Item</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                    value={qaItemId}
                    onChange={e => setQaItemId(Number(e.target.value))}
                    disabled={!qaCategory}
                  >
                    <option value="">Select an item…</option>
                    {qaItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={qaAmount}
                      onChange={e => setQaAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTransaction()}
                      className="pl-6 text-right"
                    />
                  </div>
                </div>

                {qaSuccess ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 size={16} /> Transaction added!
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={addTransaction}
                    disabled={qaAdding || !qaItemId || !qaAmount || !qaCategory}
                  >
                    {qaAdding ? 'Adding…' : 'Add Transaction'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Budget creation form */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Your Budgets</h2>
          {formMode === null && (
            <Button onClick={openForm} className="gap-2">
              <PlusCircle size={18} /> New Budget
            </Button>
          )}
        </div>

        {/* Month/Year selector + options */}
        {formMode === 'select' && (
          <Card className="border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg">New Budget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium mb-1">Month</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newMonth}
                    onChange={e => setNewMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newYear}
                    onChange={e => setNewYear(Number(e.target.value))}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <button
                  onClick={quickCreate}
                  disabled={submitting}
                  className="flex flex-col items-start gap-1 p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-indigo-500" />
                    <span className="font-semibold text-sm">Quick Create</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Create with default items, fill in amounts later</p>
                </button>

                <button
                  onClick={() => { setFormMode('wizard'); setWizardStep(0); setError(''); }}
                  className="flex flex-col items-start gap-1 p-4 rounded-lg border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" />
                    <span className="font-semibold text-sm">Start Fresh</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Walk through each category and set planned amounts</p>
                </button>

                <button
                  onClick={copyPrevious}
                  disabled={submitting}
                  className="flex flex-col items-start gap-1 p-4 rounded-lg border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
                >
                  <div className="flex items-center gap-2">
                    <Copy size={18} className="text-emerald-500" />
                    <span className="font-semibold text-sm">Copy Previous</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Copy planned amounts and income from your last budget</p>
                </button>
              </div>

              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
              <Button variant="outline" onClick={closeForm} size="sm">Cancel</Button>
            </CardContent>
          </Card>
        )}

        {/* Wizard */}
        {formMode === 'wizard' && currentStep && (
          <Card className={`border-2 ${currentStep.border}`}>
            <CardHeader className={`${currentStep.bg} rounded-t-lg pb-3`}>
              <div className="flex items-center gap-2 mb-3">
                {WIZARD_STEPS.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < wizardStep ? 'bg-indigo-600 text-white' :
                      i === wizardStep ? 'bg-indigo-200 text-indigo-800 ring-2 ring-indigo-400' :
                      'bg-gray-200 text-gray-500'
                    }`}>{i + 1}</div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div className={`h-0.5 w-8 ${i < wizardStep ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
                <span className="ml-2 text-xs text-muted-foreground">{MONTHS[newMonth - 1]} {newYear}</span>
              </div>
              <div>
                <CardTitle className={`text-lg ${currentStep.color}`}>
                  {currentStep.label} <span className="font-normal text-sm text-muted-foreground">— target {currentStep.target}%</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{currentStep.description}</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-2">
                {currentStep.items.map(name => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm flex-1">{name}</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={wizardPlanned[wizardKey(currentStep.key, name)] || ''}
                        onChange={e => setWizardPlanned(prev => ({ ...prev, [wizardKey(currentStep.key, name)]: parseFloat(e.target.value) || 0 }))}
                        className="pl-6 text-right h-9 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {stepTotal > 0 && (
                <div className="flex justify-end pt-1 border-t">
                  <span className="text-sm font-semibold">Step total: {fmt(stepTotal)}</span>
                </div>
              )}
              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
              <div className="flex justify-between pt-1">
                <Button variant="outline" size="sm" onClick={() => wizardStep === 0 ? setFormMode('select') : setWizardStep(s => s - 1)} className="gap-1">
                  <ArrowLeft size={14} /> Back
                </Button>
                {isLastStep ? (
                  <Button size="sm" onClick={createFromWizard} disabled={submitting} className="gap-1">
                    {submitting ? 'Creating…' : 'Create Budget'} <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setWizardStep(s => s + 1)} className="gap-1">
                    Next <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : budgets.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No budgets yet. Create your first one!</p>
              <Button onClick={openForm} className="gap-2">
                <PlusCircle size={18} /> New Budget
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map(b => (
              <Card
                key={b.id}
                className="cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
                onClick={() => navigate(`/budgets/${b.id}`)}
              >
                <CardContent className="p-5 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-lg">{MONTHS[b.month - 1]}</p>
                    <p className="text-muted-foreground text-sm">{b.year}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={e => { e.stopPropagation(); deleteBudget(b.id); }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
