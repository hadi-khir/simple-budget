import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Budget } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PlusCircle, Trash2, LogOut, TrendingUp } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  useEffect(() => {
    api.budgets.list().then(setBudgets).finally(() => setLoading(false));
  }, []);

  async function createBudget() {
    setCreating(true);
    setError('');
    try {
      const b = await api.budgets.create({ month: newMonth, year: newYear });
      setBudgets(prev => [b, ...prev]);
      setShowForm(false);
      navigate(`/budgets/${b.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteBudget(id: number) {
    if (!confirm('Delete this budget?')) return;
    await api.budgets.delete(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-indigo-700">Simple Budget</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hi, {user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut size={16} className="mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Your Budgets</h2>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <PlusCircle size={18} /> New Budget
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg">Create New Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium mb-1">Month</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newMonth}
                    onChange={e => setNewMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
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
                <Button onClick={createBudget} disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setError(''); }}>
                  Cancel
                </Button>
              </div>
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : budgets.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No budgets yet. Create your first one!</p>
              <Button onClick={() => setShowForm(true)} className="gap-2">
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
