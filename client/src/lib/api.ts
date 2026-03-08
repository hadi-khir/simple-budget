const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    signup: (data: { email: string; password: string; name: string }) =>
      request<{ token: string; user: User }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<User>('/auth/me'),
  },
  budgets: {
    list: () => request<Budget[]>('/budgets'),
    create: (data: { month: number; year: number }) =>
      request<Budget>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
    get: (uuid: string) => request<BudgetDetail>(`/budgets/${uuid}`),
    delete: (uuid: string) => request<void>(`/budgets/${uuid}`, { method: 'DELETE' }),
    getTransactions: (uuid: string) => request<Transaction[]>(`/budgets/${uuid}/transactions`),
    addIncome: (budgetUuid: string, data: { name: string; amount: number }) =>
      request<IncomeSource>(`/budgets/${budgetUuid}/income`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    addItem: (budgetUuid: string, data: { category: string; name: string; planned?: number; actual?: number }) =>
      request<BudgetItem>(`/budgets/${budgetUuid}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  transactions: {
    add: (itemId: number, amount: number) =>
      request<{ transaction: Transaction; item: BudgetItem }>(`/items/${itemId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    delete: (id: number) =>
      request<{ item: BudgetItem }>(`/transactions/${id}`, { method: 'DELETE' }),
  },
  income: {
    update: (id: number, data: { name?: string; amount?: number }) =>
      request<IncomeSource>(`/income/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/income/${id}`, { method: 'DELETE' }),
  },
  items: {
    update: (id: number, data: { name?: string; planned?: number; actual?: number }) =>
      request<BudgetItem>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/items/${id}`, { method: 'DELETE' }),
  },
};

export interface User {
  id: number;
  email: string;
  name: string;
  created_at?: string;
}

export interface Budget {
  id: number;
  uuid: string;
  user_id: number;
  month: number;
  year: number;
}

export interface IncomeSource {
  id: number;
  budget_id: number;
  name: string;
  amount: number;
}

export interface BudgetItem {
  id: number;
  budget_id: number;
  category: 'fundamentals' | 'fun' | 'future';
  name: string;
  planned: number;
  actual: number;
  sort_order: number;
}

export interface BudgetDetail extends Budget {
  income: IncomeSource[];
  items: BudgetItem[];
}

export interface Transaction {
  id: number;
  budget_item_id: number;
  amount: number;
  created_at: string;
  item_name: string;
  category: 'fundamentals' | 'fun' | 'future';
}
