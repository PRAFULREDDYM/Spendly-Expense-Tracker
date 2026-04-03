import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ViewState = 'splash' | 'signin' | 'signup' | 'onboarding' | 'dashboard' | 'history' | 'analysis' | 'profile';

export interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'saving';
  amount: number;
  title: string;
  category: string;
  date: string;
  icon: string;
  colorClass: string;
}

interface StoreContextType {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isAddModalOpen: boolean;
  setAddModalOpen: (isOpen: boolean) => void;
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  balance: number;
  income: number;
  expenses: number;
  savings: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<ViewState>('splash');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  
  // Initial mock data
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', type: 'expense', amount: 12.40, title: 'Fast Food Express', category: 'Food', date: new Date().toISOString(), icon: '🍔', colorClass: 'bg-[#FFEDD5]' },
    { id: '2', type: 'expense', amount: 15.99, title: 'Streaming Service', category: 'Entertainment', date: new Date(Date.now() - 86400000).toISOString(), icon: '📺', colorClass: 'bg-[#DBEAFE]' },
    { id: '3', type: 'income', amount: 850.00, title: 'Freelance Payment', category: 'Income', date: new Date(Date.now() - 86400000 * 2).toISOString(), icon: '💼', colorClass: 'bg-[#DCFCE7]' },
    { id: '4', type: 'expense', amount: 24.50, title: 'Ride Share', category: 'Transport', date: new Date(Date.now() - 86400000 * 3).toISOString(), icon: '🚗', colorClass: 'bg-[#F3E8FF]' },
  ]);

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    setTransactions([{ ...t, id: Math.random().toString(36).substr(2, 9) }, ...transactions]);
  };

  // Calculate totals based on mock base + actual transactions
  const baseIncome = 4200;
  const baseExpenses = 2360;
  const baseSavings = 240;

  const dynamicIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const dynamicExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const dynamicSavings = transactions.filter(t => t.type === 'saving').reduce((acc, t) => acc + t.amount, 0);

  const income = baseIncome + dynamicIncome;
  const expenses = baseExpenses + dynamicExpenses;
  const savings = baseSavings + dynamicSavings;
  const balance = income - expenses - savings;

  return (
    <StoreContext.Provider value={{ 
      currentView, 
      setCurrentView, 
      isAddModalOpen, 
      setAddModalOpen, 
      transactions, 
      addTransaction, 
      balance, 
      income, 
      expenses, 
      savings 
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
